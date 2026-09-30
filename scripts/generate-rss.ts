import fs from "fs";
import path from "path";
import RSS from "rss";
import matter from "gray-matter";

/**
 * 站点绝对地址的来源
 * ------------------
 * 优先级：SITE_URL 环境变量 → site.config.json 的 canonicalOrigin → 报错退出。
 *
 * 这里**刻意不提供写死的兜底域名**。上一版写的是 `https://<某个子域>`，
 * 那个子域后来被废弃、整站 404，而 Vercel 的构建环境里没有 SITE_URL，
 * 于是兜底值悄悄生效，导致 Vercel 上的 rss.xml 里每一条链接都是死链 ——
 * 而且因为站点本身正常，这个 bug 没有任何外在症状。
 *
 * 教训：一个「看起来没问题的默认值」比一个显式的报错危险得多。
 * 地址这种事实必须只有一个出处，读不到就宁可让构建失败。
 */
function resolveSiteUrl(): string {
  const fromEnv = process.env.SITE_URL?.trim();
  if (fromEnv) return stripTrailingSlash(fromEnv);

  const configPath = path.join(process.cwd(), "site.config.json");
  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8")) as {
      canonicalOrigin?: string;
    };
    if (config.canonicalOrigin) return stripTrailingSlash(config.canonicalOrigin);
  } catch {
    // 交给下面统一报错
  }

  console.error(
    "[generate-rss] 无法确定站点地址：既没有 SITE_URL 环境变量，" +
      "也没能从 site.config.json 读到 canonicalOrigin。\n" +
      "              请检查 site.config.json 是否存在且格式正确（见该文件内的 _readme）。"
  );
  process.exit(1);
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

const SITE_URL = resolveSiteUrl();
const CONTENT_DIR = path.join(process.cwd(), "content");
const OUT_DIR = path.join(process.cwd(), "out");

function main() {
  const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".mdx"));

  const posts: Array<{ slug: string; title: string; date: string; summary?: string; tags?: string[]; draft?: boolean }> = files
    .map((filename) => {
      const slug = filename.replace(/\.mdx$/, "");
      const raw = fs.readFileSync(path.join(CONTENT_DIR, filename), "utf-8");
      const { data } = matter(raw);
      return { slug, title: data.title, date: data.date, summary: data.summary, tags: data.tags, draft: data.draft };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const feed = new RSS({
    title: "Jack 的 AI Blog",
    description: "关于 AI、技术与工程的博客。",
    feed_url: `${SITE_URL}/rss.xml`,
    site_url: SITE_URL,
    language: "zh-CN",
  });

  for (const post of posts) {
    if (post.draft) continue;
    feed.item({
      title: post.title,
      description: post.summary ?? "",
      url: `${SITE_URL}/posts/${post.slug}`,
      date: new Date(post.date),
      categories: post.tags ?? [],
    });
  }

  // 注意：这里是**唯一**会跳过 draft 的地方。src/lib/posts.ts 并不读 draft 字段，
  // 所以 draft: true 只能让它从 RSS 里消失，首页列表和 /posts/<slug> 页面照样生成。
  // 想做真正的草稿，只能先别把文件放进 content/。
  const skippedDrafts = posts.filter((p) => p.draft).length;
  const published = posts.length - skippedDrafts;

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "rss.xml"), feed.xml({ indent: true }));
  console.log(
    `RSS feed generated: out/rss.xml (${published} posts` +
      (skippedDrafts > 0 ? `, ${skippedDrafts} drafts skipped)` : ")") +
      ` · site_url=${SITE_URL}`
  );
}

main();
