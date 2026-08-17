import fs from "fs";
import path from "path";
import RSS from "rss";
import matter from "gray-matter";

const SITE_URL = process.env.SITE_URL || "https://ai-blog-vercel.jacklearn.tech";
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

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "rss.xml"), feed.xml({ indent: true }));
  console.log(`RSS feed generated: out/rss.xml (${posts.length} posts)`);
}

main();
