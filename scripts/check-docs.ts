/**
 * 文档与事实一致性检查 —— `npm run check:docs`
 *
 * 为什么需要它
 * ------------
 * 这个项目里几乎所有「过时信息」都是同一个模式：**同一个事实被写在多个地方，改动时只更新了其中一部分**。
 *
 * 2026-09-30 的一次审计发现：
 *   - `CLAUDE.md` 与 `.ai/architecture.md` 里的域名还停在一个早已废弃、整站 404 的子域上
 *     （具体是哪几个见 `site.config.json` 的 retired 列表）
 *   - 同一份过期域名还被硬编码进 `scripts/generate-rss.ts` 当兜底值，
 *     因为 Vercel 构建没有 SITE_URL 环境变量，导致 **Vercel 的 RSS 里每一条链接都是死链**
 *   - `.ai/project_map.md` 描述了一个并不存在的 `public/` 目录
 *
 * 更根本的问题是：项目原有的规则是「先更新 .ai/ 文档 → 再改代码 → 跑 npm run build 验证」，
 * 但 `npm run build` 只验证代码能否编译，**完全不检查文档**。
 * 于是规则里唯一有强制力的那一步与文档无关 —— 文档要求处于「零成本违反」状态。
 *
 * 这个脚本补上缺的那一环：把文档里的断言变成可机器校验的对象。
 *
 * 检查项
 * ------
 * 1. 域名登记（失败级）：仓库里任何 `*.jacklearn.tech` 提及，都必须在 `site.config.json`
 *    的 sites / aliases 里登记过；命中 retired 列表的域名直接判失败。
 *    两种例外：
 *      - 同一行里带「已退役 / 已废弃 / retired」等标记的，视为**历史叙述**，放行；
 *      - `content/` 下的文章降级为警告 —— 文章是叙事不是规范，
 *        一篇写于 2026-08 的旧文提到当年的域名是正确的，不该要求它改口。
 * 2. npm 脚本存在（失败级）：文档里出现的 `npm run X` / `npm start`，X 必须在 package.json 的 scripts 里。
 * 3. 路径存在（失败级）：文档里反引号包裹的仓库内路径必须真实存在，含目录引用
 *    （形如 `src/app/`、`content/`）。这是启发式检查：相对路径、glob、包名会跳过，
 *    位于否定语境（如「没有 `tailwind.config.ts`」）的路径也会跳过。
 * 4. 文档新鲜度（警告级）：每份文档首行应有 `<!-- last-verified: YYYY-MM-DD -->`，
 *    缺失或超过 90 天未核实只提示、不失败。
 *
 * 用法
 * ----
 *     npm run check:docs            # 正常检查
 *     npm run check:docs -- --verbose   # 额外打印被跳过的路径 token，便于人工复核
 *
 * 退出码：0 = 通过（可含警告），1 = 存在失败项。
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(process.cwd());
const VERBOSE = process.argv.includes("--verbose");

const CONFIG_FILE = "site.config.json";

/** 整份跳过的文件（配置自身含 retired 域名；锁文件是机器生成的） */
const SKIP_FILES = new Set([CONFIG_FILE, "package-lock.json", "pnpm-lock.yaml", "yarn.lock"]);

/** 跳过的目录前缀 */
const SKIP_DIRS = ["node_modules/", "out/", ".next/", ".git/", ".vercel/"];

/** 跳过的二进制扩展名 */
const BINARY_EXTS = new Set([
  ".ico", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif",
  ".woff", ".woff2", ".ttf", ".otf", ".pdf", ".zip", ".gz",
]);

/** 参与「路径 / npm 脚本」检查的文档 */
const DOC_FILES = [/^README\.md$/, /^CLAUDE\.md$/, /^\.ai\/.*\.md$/];

/** 需要标注核实日期的文档：描述「当前状态」的那些
 *  ADR 是历史记录，写下来就不再改动，因此不需要（也不应该）有核实日期 */
const FRESHNESS_FILES = [
  /^README\.md$/,
  /^CLAUDE\.md$/,
  /^\.ai\/architecture\.md$/,
  /^\.ai\/project_map\.md$/,
  /^\.ai\/modules\/.*\.md$/,
];

/** 反引号里的 token 被当作仓库内路径的判定：以这些目录开头 */
const PATH_ROOTS = ["src/", "scripts/", "content/", "ops/", ".ai/", "public/"];
/** 或者：以这些扩展名结尾的裸文件名 */
const PATH_EXTS = [".md", ".ts", ".tsx", ".json", ".mjs", ".cjs", ".css", ".xml"];

/** 这些位置属于构建产物，检查时允许「此刻不存在」 */
const IGNORE_PATH_ROOTS = ["out/", "node_modules/", ".next/"];

/** 域名检查降级为「警告」的目录：文章是叙事，不是规范 */
const DOMAIN_WARN_ONLY_ROOTS = ["content/"];

/** 否定语境标记：token 出现在它们之后时跳过（文档常在描述「不存在的东西」） */
const NEGATION = /(?:\bno\b|\bnot\b|\bwithout\b|instead of|rather than|没有|不再|不存在|无需|不要|不是|而非|而不是|从未|已经废弃|已废弃)\s*$/i;
/** 往前看多少字符判断否定语境 */
const NEGATION_WINDOW = 60;

/**
 * 后置否定：有些句子把否定写在 token 之后，例如
 *     **`public/` does not exist.**
 *     ...documented a `public/` directory, which never existed
 * 只看前文会误报，因此在 token 之后的一小段窗口里再找一次否定词。
 * 刻意不做锚定匹配：定位到「第几个词之后」既脆弱又难解释，
 * 而这里误报（漏检）是可以接受的 —— 见 ADR-005 的取舍说明。
 */
const POST_NEGATION = /(?:does\s+not\s+exist|doesn't\s+exist|never\s+existed|is\s+not\s+present|不存在|并不存在|已废弃|已退役|从未存在)/i;
const POST_NEGATION_WINDOW = 60;

/**
 * 退役标记：一行里出现这些词时，对已退役域名的提及视为「历史叙述」，放行。
 * 目的是禁止「误用」，而不是禁止「记录」—— ADR 这类文档本来就必须写下当年的事实。
 */
const RETIREMENT_MARKER = /(已退役|已废弃|已下线|废弃|退役|不再使用|retired|deprecated|dead\s+link|死链)/i;

/** 文档新鲜度阈值（天） */
const STALE_DAYS = 90;

const LAST_VERIFIED_RE = /<!--\s*last-verified:\s*(\d{4}-\d{2}-\d{2})\s*-->/;
const DOMAIN_RE = /\b((?:[a-z0-9][a-z0-9-]*\.)*jacklearn\.tech)\b/gi;
const BACKTICK_RE = /`([^`\n]+)`/g;
const NPM_RUN_RE = /\bnpm run ([a-z0-9:_-]+)/g;
const NPM_PLAIN_RE = /\bnpm (start|test)\b/g;

interface SiteConfig {
  apexDomain: string;
  canonicalOrigin: string;
  sites: { host: string; origin: string }[];
  aliases: { host: string }[];
  retired: { host: string }[];
}

const failures: string[] = [];
const warnings: string[] = [];
const skipped: string[] = [];

function fail(msg: string): void {
  failures.push(msg);
}
function warn(msg: string): void {
  warnings.push(msg);
}

/** 列出仓库内需要扫描的文件；优先用 git，非 git 环境退化为遍历
 *
 * 注意必须带上 `--others --exclude-standard`：新加的文件在 `git add` 之前是 untracked，
 * 只列 tracked 的话，检查器会正好漏掉「这次新写的文档」——那恰恰是最需要检查的部分。
 */
function listFiles(): string[] {
  try {
    return execSync("git ls-files --cached --others --exclude-standard", {
      cwd: ROOT,
      encoding: "utf-8",
    })
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    const acc: string[] = [];
    (function walk(dir: string) {
      for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        if (e.name === ".git") continue;
        const rel = dir ? `${dir}/${e.name}` : e.name;
        if (e.isDirectory()) walk(rel);
        else acc.push(rel);
      }
    })("");
    return acc;
  }
}

function isScannable(rel: string): boolean {
  if (SKIP_FILES.has(rel)) return false;
  if (SKIP_DIRS.some((d) => rel.startsWith(d))) return false;
  if (BINARY_EXTS.has(path.extname(rel).toLowerCase())) return false;
  return true;
}

function readText(rel: string): string | null {
  try {
    return fs.readFileSync(path.join(ROOT, rel), "utf-8");
  } catch {
    return null;
  }
}

function isDoc(rel: string): boolean {
  return DOC_FILES.some((re) => re.test(rel));
}

/**
 * 判断反引号里的 token 是否是一个「应当存在」的仓库内路径。
 * 判断不了的一律放行，避免误报 —— 误报会让检查失去信任。
 */
function looksLikeRepoPath(tok: string): boolean {
  if (!tok || tok.length > 120) return false;
  // 相对路径、绝对路径、家目录一律不检查
  if (tok.startsWith("./") || tok.startsWith("../") || tok.startsWith("/") || tok.startsWith("~")) {
    return false;
  }
  // 允许「目录引用」形式：一个结尾斜杠，如 `src/app/`、`content/`。
  // 这一点曾经漏掉 —— 早期版本直接判定「含空段」就跳过，于是所有以 / 结尾的目录引用
  // 全部不在检查范围内，`public/` 这种最典型的漂移反而查不到。
  const body = tok.endsWith("/") ? tok.slice(0, -1) : tok;
  if (body === "") return false;
  // glob / 包名 / 占位符 / 带参数调用：剥掉方括号后再看是否含特殊字符
  if (/[*?@:<>\s|{}()]/.test(body.replace(/[[\]]/g, ""))) return false;
  if (body.includes("...")) return false;
  if (body.split("/").some((seg) => seg === "")) return false;
  // 产物目录允许「此刻不存在」
  if (IGNORE_PATH_ROOTS.some((r) => tok.startsWith(r))) return false;
  // 注意顺序：先判已知根目录（含 `.ai/`，它以点开头），再判裸文件名
  if (PATH_ROOTS.some((r) => tok.startsWith(r))) return true;
  return !tok.includes("/") && PATH_EXTS.some((e) => tok.endsWith(e));
}

function existsInRepo(rel: string): boolean {
  return fs.existsSync(path.join(ROOT, rel));
}

// ---------------------------------------------------------------- 1. 域名登记

function checkDomains(files: string[], allowed: Set<string>, retired: Set<string>): void {
  for (const rel of files) {
    if (!isScannable(rel)) continue;
    const text = readText(rel);
    if (text === null) continue;

    const warnOnly = DOMAIN_WARN_ONLY_ROOTS.some((r) => rel.startsWith(r));
    const lines = text.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const matches = line.match(DOMAIN_RE);
      if (!matches) continue;

      // 带退役标记的行属于历史叙述，放行（ADR 必须能写下当年的事实）
      if (RETIREMENT_MARKER.test(line)) {
        if (VERBOSE) skipped.push(`${rel}:${i + 1} 已退役域名的历史叙述，跳过`);
        continue;
      }

      for (const raw of matches) {
        const host = raw.toLowerCase();
        const bad = retired.has(host)
          ? `${rel}:${i + 1} 引用了**已退役**的域名 ${host}` +
            `\n      该域名已废弃（整站 404），请改用 site.config.json 里登记的域名`
          : allowed.has(host)
            ? null
            : `${rel}:${i + 1} 出现未登记的域名 ${host}` +
              `\n      请在 site.config.json 的 sites / aliases 里登记，或改为引用已有条目`;

        if (bad === null) continue;
        // 文章是叙事，降级为警告；文档 / 配置 / 代码是规范，判失败
        if (warnOnly) warn(`${bad}（位于 content/，仅提示）`);
        else fail(bad);
      }
    }
  }
}

// ------------------------------------------------- 2 & 3. npm 脚本 / 路径存在性

function checkDocs(files: string[]): void {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf-8")) as {
    scripts?: Record<string, string>;
  };
  const scripts = new Set(Object.keys(pkg.scripts ?? {}));

  const docs = files.filter(isDoc);

  for (const rel of docs) {
    const text = readText(rel);
    if (text === null) continue;

    // --- npm 脚本名 ---
    const scriptHits: [string, string][] = [];
    for (const re of [NPM_RUN_RE, NPM_PLAIN_RE]) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) scriptHits.push([m[1], m[0]]);
    }
    for (const [name, full] of scriptHits) {
      if (!scripts.has(name)) {
        fail(`${rel} 提到 \`${full}\`，但 package.json 的 scripts 里没有 "${name}"`);
      }
    }

    // --- 反引号里的仓库内路径 ---
    BACKTICK_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = BACKTICK_RE.exec(text)) !== null) {
      const tok = m[1].trim();
      if (!looksLikeRepoPath(tok)) continue;

      const before = text.slice(Math.max(0, m.index - NEGATION_WINDOW), m.index);
      if (NEGATION.test(before.replace(/[\s*_`>-]+$/, " "))) {
        if (VERBOSE) skipped.push(`${rel}: \`${tok}\`（前置否定语境，跳过）`);
        continue;
      }

      // 否定也可能写在后面：「**`public/` does not exist.**」
      const afterEnd = m.index + m[0].length;
      const after = text.slice(afterEnd, afterEnd + POST_NEGATION_WINDOW);
      if (POST_NEGATION.test(after)) {
        if (VERBOSE) skipped.push(`${rel}: \`${tok}\`（后置否定语境，跳过）`);
        continue;
      }

      if (!existsInRepo(tok)) {
        const line = text.slice(0, m.index).split("\n").length;
        fail(`${rel}:${line} 引用的路径 \`${tok}\` 在仓库里不存在`);
      }
    }
  }
}

// ---------------------------------------------------------------- 4. 新鲜度

function checkFreshness(files: string[]): void {
  const docs = files.filter((f) => FRESHNESS_FILES.some((re) => re.test(f)));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const rel of docs) {
    const text = readText(rel);
    if (text === null) continue;

    const head = text.split("\n").slice(0, 5).join("\n");
    const m = head.match(LAST_VERIFIED_RE);
    if (!m) {
      warn(`${rel} 缺少核实日期标记，请在第一行加 <!-- last-verified: YYYY-MM-DD -->`);
      continue;
    }

    const verified = new Date(`${m[1]}T00:00:00`);
    const days = Math.round((today.getTime() - verified.getTime()) / 86_400_000);
    if (Number.isNaN(days)) {
      warn(`${rel} 的 last-verified 日期无法解析：${m[1]}`);
    } else if (days > STALE_DAYS) {
      warn(`${rel} 已 ${days} 天未核实（标记 ${m[1]}），请对照代码确认后更新日期`);
    }
  }
}

// ---------------------------------------------------------------------- main

function main(): void {
  const configPath = path.join(ROOT, CONFIG_FILE);
  if (!fs.existsSync(configPath)) {
    console.error(`[check-docs] 找不到 ${CONFIG_FILE}，它是本站事实的单一来源，必须先建立`);
    process.exit(1);
  }
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8")) as SiteConfig;

  const allowed = new Set<string>([
    ...config.sites.map((s) => s.host.toLowerCase()),
    ...config.aliases.map((a) => a.host.toLowerCase()),
    config.apexDomain.toLowerCase(),
  ]);
  const retired = new Set(config.retired.map((r) => r.host.toLowerCase()));

  const files = listFiles();
  console.log(`[check-docs] 扫描 ${files.length} 个受版本控制的文件`);

  checkDomains(files, allowed, retired);
  checkDocs(files);
  checkFreshness(files);

  if (VERBOSE && skipped.length > 0) {
    console.log("\n[check-docs] 以下 token 因处于否定语境被跳过，可人工复核：");
    for (const s of skipped) console.log(`    ${s}`);
  }

  if (warnings.length > 0) {
    console.log(`\n[check-docs] ${warnings.length} 条警告（不影响退出码）：`);
    for (const w of warnings) console.log(`    WARN  ${w}`);
  }

  if (failures.length > 0) {
    console.error(`\n[check-docs] ${failures.length} 项失败：`);
    for (const f of failures) console.error(`    FAIL  ${f}`);
    console.error(
      "\n  文档或代码引用了与站点事实不符的内容。" +
        "\n  如果这个事实确实变了，请先改 site.config.json（单一来源），再同步各处引用。" +
        "\n  如果确认无误，可以用 ops/release.sh publish --force 跳过本次检查（不推荐）。"
    );
    process.exit(1);
  }

  console.log("\n[check-docs] 通过：域名登记、npm 脚本、路径引用、文档新鲜度均无问题");
}

main();
