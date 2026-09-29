#!/bin/bash
# ============================================================
# ai-blog 发布脚本（服务器端唯一入口）
#
#   ops/release.sh deploy                拉取 GitHub → 构建 → 上线      （定时任务用）
#   ops/release.sh publish "提交信息"     提交 → 构建 → 上线 → 推 GitHub （人工 / WorkBuddy 用）
#
#   两个模式都可加 --force 强制重新构建
#
# 设计要点：
#   - push 只在「构建 + 自检」都成功之后执行 → GitHub 上永远不会出现坏版本
#   - 构建前备份 out/，失败自动回滚 → 线上不会白屏
#   - publish 构建失败时撤销本次提交（文件改动保留）→ 修完可直接重试
#   - deploy 模式在「本地有未推送提交」时跳过 → 不会与 publish 抢方向盘
#   - flock 串行化；deployed-sha 记录「已成功部署的本地 HEAD」
# ============================================================

set -uo pipefail
umask 022
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8

APP_DIR=/www/wwwroot/ai-blog
OUT="$APP_DIR/out"
PREV="$APP_DIR/out.prev"
BRANCH=main
REMOTE_NAME=origin
NODE_BIN=/www/server/nodejs/v24.19.0/bin
PY_BIN=/usr/bin/python3
[ -x "$PY_BIN" ] || PY_BIN=python3
SITE_URL_VALUE=https://jacklearn.tech
HOST_HEADER=jacklearn.tech

LOG=/www/wwwlogs/ai_blog.deploy.log
LOCK=/var/lock/ai-blog-release.lock
STATE_DIR=/var/lib/ai-blog-deploy
DEPLOYED_SHA_FILE="$STATE_DIR/deployed-sha"
FAILED_SHA_FILE="$STATE_DIR/failed-sha"

# publish 默认纳入提交的路径（存在的才会被 add）
DEFAULT_ADD_PATHS=(content src scripts ops public .gitignore next.config.ts package.json)

# ---------- 参数 ----------
MODE="${1:-}"
shift 2>/dev/null || true
FORCE=0
POS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --force) FORCE=1 ;;
    *) POS+=("$1") ;;
  esac
  shift
done

case "$MODE" in
  deploy|publish) ;;
  *) echo "用法: $0 deploy|publish [\"提交信息\"] [--force]" >&2; exit 64 ;;
esac

log() { printf '%s  %s\n' "$(date '+%F %T')" "$*" >> "$LOG"; }
say() { local m; m="$(date '+%F %T')  $*"; printf '%s\n' "$m" >> "$LOG"; printf '%s\n' "$m"; }

# ---------- 串行化 ----------
mkdir -p "$STATE_DIR"
exec 9>"$LOCK"
if ! flock -n 9; then
  say "SKIP   已有实例在运行，本次跳过"
  exit 0
fi

cd "$APP_DIR" || { say "FATAL  无法进入 $APP_DIR"; exit 1; }
export GIT_SSH_COMMAND="ssh -o StrictHostKeyChecking=accept-new -o BatchMode=yes"

# ---------- 公共：构建 → 压缩 → 自检 →（失败则回滚） ----------
rollback() {
  if [ -d "$PREV" ]; then
    rm -rf "$OUT"
    mv "$PREV" "$OUT"
    say "ROLLBK 已恢复上一版本（线上内容回退到构建前）"
  else
    say "ROLLBK 无备份可用（首次部署），线上可能不可用，请立即人工检查"
  fi
}

check() {
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' -m 15 -H "Host: $HOST_HEADER" "http://127.0.0.1$1")
  if [ "$code" != "$2" ]; then
    say "      自检失败：$1 期望 $2 实际 $code"
    return 1
  fi
  return 0
}

build_deploy() {
  rm -rf "$PREV"
  if [ -d "$OUT" ]; then
    cp -a "$OUT" "$PREV" || { say "FAIL  备份 out/ 失败，中止（不做无备份的构建）"; return 1; }
  fi

  export PATH="$NODE_BIN:$PATH"
  export SITE_URL="$SITE_URL_VALUE"
  export NODE_ENV=production
  export CI=1

  local t0 t1 failed=0 post
  t0=$(date +%s)
  if ! "$NODE_BIN/npm" run build >>"$LOG" 2>&1; then
    say "FAIL  构建失败（详见上方日志）"
    rollback; return 1
  fi
  t1=$(date +%s)
  say "      构建完成，耗时 $(( t1 - t0 )) 秒"

  if [ ! -s "$OUT/index.html" ]; then
    say "FAIL  构建产物缺少 index.html"
    rollback; return 1
  fi

  find "$OUT" -type f \( -name '*.html' -o -name '*.css' -o -name '*.js' \
    -o -name '*.xml' -o -name '*.txt' -o -name '*.svg' -o -name '*.json' \) \
    -exec gzip -9 -k -n -f {} \; >>"$LOG" 2>&1
  chown -R www:www "$OUT"

  check / 200 || failed=1
  [ -f "$OUT/rss.xml" ]   && { check /rss.xml 200 || failed=1; }
  check /no-such-page-xyz 404 || failed=1

  post=$(cd "$OUT/posts" 2>/dev/null && ls *.html 2>/dev/null | head -1)
  [ -n "$post" ] && { check "/posts/${post%.html}" 200 || failed=1; }

  [ -f "$OUT/tags.html" ] && { check /tags 200 || failed=1; }

  # 标签页逐个实测。标签可能含空格或非 ASCII，必须用**浏览器会发出的编码形态**去请求：
  # 直接测磁盘上的原文名是测不出问题的，那正是这个 bug 藏了一个月的原因。
  # 刻意只 WARN、不计入 failed：标签链接坏掉只影响导航，不该阻断整次发布。
  if [ -f "$OUT/tags.html" ] && [ -d "$OUT/tags" ]; then
    "$PY_BIN" -c "import os,sys,urllib.parse
d=os.path.join(sys.argv[1],'tags')
for n in sorted(os.listdir(d)):
    if not n.endswith('.html'):
        continue
    t=n[:-5]
    if any(c in t for c in '/?#'):
        continue
    print(urllib.parse.quote(t))" "$OUT" > /tmp/ai-blog-tagurls 2>>"$LOG" || true

    local tbad=0 turl
    while IFS= read -r turl; do
      [ -z "$turl" ] && continue
      check "/tags/$turl" 200 || tbad=$(( tbad + 1 ))
    done < /tmp/ai-blog-tagurls

    if [ "$tbad" = "0" ]; then
      say "      标签页自检通过（$(grep -c . /tmp/ai-blog-tagurls) 个）"
    else
      say "      WARN  有 $tbad 个标签页不可访问（只告警，不阻断发布）"
    fi
  fi

  if [ "$failed" != "0" ]; then
    say "FAIL  上线自检未通过"
    rollback; return 1
  fi
  return 0
}

mark_deployed() {
  rm -rf "$PREV"
  git rev-parse HEAD > "$DEPLOYED_SHA_FILE"
  rm -f "$FAILED_SHA_FILE"
}

# ============================================================
# 模式一：deploy —— 拉取 GitHub 后构建上线（定时任务）
# ============================================================
if [ "$MODE" = "deploy" ]; then
  if ! git fetch --quiet "$REMOTE_NAME" "$BRANCH" 2>>"$LOG"; then
    say "FAIL  git fetch 失败（网络或凭据问题），本次跳过，下轮重试"
    exit 1
  fi

  # 守卫：本地有未推送提交时什么都不做，避免与 publish 抢方向盘
  AHEAD=$(git rev-list --count "$REMOTE_NAME/$BRANCH..HEAD" 2>/dev/null || echo 0)
  if [ "$AHEAD" != "0" ]; then
    exit 0
  fi

  if [ "$FORCE" = "0" ]; then
    if ! git merge --ff-only "$REMOTE_NAME/$BRANCH" >>"$LOG" 2>&1; then
      say "FAIL  无法快进到 $REMOTE_NAME/$BRANCH（分叉或未提交改动冲突），已放弃"
      exit 1
    fi
    HEAD_SHA=$(git rev-parse HEAD)
    DEPLOYED=$(cat "$DEPLOYED_SHA_FILE" 2>/dev/null || true)
    [ "$HEAD_SHA" = "$DEPLOYED" ] && exit 0            # 已是最新，静默退出
    FAILED=$(cat "$FAILED_SHA_FILE" 2>/dev/null || true)
    [ "$HEAD_SHA" = "$FAILED" ] && exit 0              # 该提交上次构建就失败，不再重试
  else
    git merge --ff-only "$REMOTE_NAME/$BRANCH" >>"$LOG" 2>&1 || true
    HEAD_SHA=$(git rev-parse HEAD)
  fi

  say "DEPLOY 远端更新 · $(git log --oneline -1)"
  if build_deploy; then
    mark_deployed
    say "OK     上线成功 · $(git log --oneline -1 | cut -c1-40) · out/ $(du -sh "$OUT" | cut -f1)"
    exit 0
  fi
  echo "$HEAD_SHA" > "$FAILED_SHA_FILE"
  say "      已记录失败提交，定时任务不会重复重试；修复后可用 --force 或新提交触发"
  exit 1
fi

# ============================================================
# 模式二：publish —— 提交 → 构建 → 上线 → 推回 GitHub
# ============================================================
MSG="${POS[0]:-}"
[ -z "$MSG" ] && MSG="publish: $(date '+%F %T')"

# 提交身份必须显式配置，否则 git 会用主机名拼一个假作者
if [ -z "$(git config user.email || true)" ]; then
  say "FATAL 未配置 git 提交身份，请先执行："
  say "      git -C $APP_DIR config user.name  \"你的名字\""
  say "      git -C $APP_DIR config user.email \"你的邮箱\""
  exit 1
fi

# 1. 先与远端对齐，避免推送被拒
if ! git fetch --quiet "$REMOTE_NAME" "$BRANCH" 2>>"$LOG"; then
  say "FAIL  git fetch 失败，无法确认远端状态，中止（不推送）"
  exit 1
fi
AHEAD=$(git rev-list --count "$REMOTE_NAME/$BRANCH..HEAD" 2>/dev/null || echo 0)
BEHIND=$(git rev-list --count "HEAD..$REMOTE_NAME/$BRANCH" 2>/dev/null || echo 0)
if [ "$BEHIND" != "0" ] && [ "$AHEAD" = "0" ]; then
  git merge --ff-only "$REMOTE_NAME/$BRANCH" >>"$LOG" 2>&1 \
    || { say "FAIL  无法快进到远端，中止"; exit 1; }
  say "      已先快进到远端 $(git rev-parse --short HEAD)"
elif [ "$BEHIND" != "0" ]; then
  say "      远端有 $BEHIND 个新提交、本地有 $AHEAD 个未推送提交，先 rebase"
  git pull --rebase "$REMOTE_NAME" "$BRANCH" >>"$LOG" 2>&1 \
    || { say "FAIL  rebase 出现冲突，请人工处理后重试"; exit 1; }
fi

# 2. 暂存并提交
ADD=()
for p in "${DEFAULT_ADD_PATHS[@]}"; do
  [ -e "$APP_DIR/$p" ] && ADD+=("$p")
done
if [ "${#ADD[@]}" = "0" ]; then
  say "FATAL 可提交的路径一个都不存在，异常，中止"
  exit 1
fi
git add -- "${ADD[@]}"

UNSTAGED=$(git diff --name-only)
[ -n "$UNSTAGED" ] && say "WARN  以下已跟踪文件的改动未纳入提交（构建会带上，但不会推到 GitHub）：$(echo "$UNSTAGED" | tr '\n' ' ')"

COMMITTED=0
if git diff --cached --quiet; then
  if [ "$FORCE" = "0" ]; then
    say "SKIP  publish：没有需要提交的变更（若只想重建，加 --force）"
    exit 0
  fi
  say "      publish --force：无变更，直接重建"
else
  git commit -m "$MSG" >>"$LOG" 2>&1 || { say "FATAL 提交失败"; exit 1; }
  COMMITTED=1
  say "PUB   commit $(git rev-parse --short HEAD) · $MSG"
  say "      变更文件：$(git show --stat --format="" HEAD | sed '/^$/d' | tr '\n' ' ')"
fi

# 3. 构建 + 上线（失败则撤销提交，且绝不推送）
if build_deploy; then
  mark_deployed
  say "OK     上线成功 · out/ $(du -sh "$OUT" | cut -f1) · gz $(find "$OUT" -name '*.gz' | wc -l) 个"
else
  if [ "$COMMITTED" = "1" ] && git rev-parse HEAD~1 >/dev/null 2>&1; then
    git reset --soft HEAD~1
    say "      已撤销本次提交（文件改动仍保留在工作区），不会推送到 GitHub"
  fi
  exit 1
fi

# 4. 确认部署成功之后，才把代码备份到 GitHub
if [ "$COMMITTED" = "0" ]; then
  say "PUSH  跳过（本次没有新提交）"
  exit 0
fi

if git push "$REMOTE_NAME" "$BRANCH" >>"$LOG" 2>&1; then
  say "PUSH  已备份到 GitHub · $REMOTE_NAME/$BRANCH @ $(git rev-parse --short HEAD)"
  exit 0
fi

say "WARN  push 失败（远端可能又变了），提交保留在本地，站点已正常上线"
say "      下次 publish 会先 rebase 再重试推送"
exit 2
