import type { MetadataRoute } from "next";
// 站点地址的单一来源。这里不写死域名 —— 硬编码一份副本正是 2026-09-30 那次
// 「RSS 全是死链却毫无症状」的成因（ADR-005）。
import siteConfig from "../../site.config.json";
import { getAllPosts, getAllTags } from "@/lib/posts";

/**
 * /sitemap.xml —— 由 App Router 的「元数据路由」在构建期生成到 out/sitemap.xml。
 *
 * 它解决的是什么问题
 * -----------------
 * robots.txt 只能告诉爬虫「可以抓」，但不会告诉它「有哪些页面」。没有 sitemap 时，
 * 发现全部文章的唯一途径是顺着首页链接一层层爬；标签页这种入口很深的页面很容易被漏掉。
 * 有了这份清单，爬虫一次请求就能拿到全站 URL。
 *
 * 为什么列的是四类而不是「遍历 out/ 下所有 .html」
 * ------------------------------------------------
 * 因为 out/ 里还有一批由静态导出附带产生的 RSC 预取载荷（`__next._full.txt` 之类）
 * 与 404 页面，那些不该出现在 sitemap 里。这里从 `content/` 与 `src/lib/posts.ts`
 * 的既有读取函数出发，列的就是「真正意义上的页面」，与站内导航能到达的集合一致。
 *
 * 为什么镜像站（Vercel）也生成同一份
 * --------------------------------
 * 条目里的地址一律取自 `canonicalOrigin`（www 主站），即便这份文件是在镜像站构建出来的。
 * 这与 RSS 的处理保持一致：两个域名指向同一份内容，**规范地址只能有一个**，
 * 两边各自声明自己是规范地址会互相打架。要让镜像站自己当规范地址，
 * 得先改 site.config.json —— 而不是在这里加判断。
 *
 * 关于 lastModified
 * ---------------
 * 站点级页面（首页 / 标签索引）用的是**最新一篇文章的日期**，不是 `new Date()`。
 * 构建时刻每次都会变，用它等于对爬虫声称「全站每天更新」；这种假信号一旦被识破，
 * 整份 sitemap 的 lastmod 都会失去参考价值。而首页确实只会在发了新文章时内容才变，
 * 用文章日期既真实又更有效。
 */

/**
 * **这一行不是可选的。** 在 `output: 'export'` 下，元数据路由默认被当作可能动态渲染的
 * Route Handler 处理，构建会直接报错：
 *     Error: export const dynamic = "force-static"/export const revalidate not configured
 *            on route "/sitemap.xml" with "output: export"
 * 声明 force-static 等于告诉 Next「构建期算一次、写成文件」，这正是静态导出需要的形式。
 * 这条坑在 robots.ts 上已经踩过一次，新增元数据路由务必一并带上。
 */
export const dynamic = "force-static";

/** 空值 / 非法日期返回 undefined —— 宁可省略 lastmod，也不要输出一个空标签让爬虫困惑 */
function toLastModified(value?: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteConfig.canonicalOrigin;
  const posts = getAllPosts();
  const tags = getAllTags();

  const latestPostDate = toLastModified(posts[0]?.date);

  const entries: MetadataRoute.Sitemap = [
    {
      url: `${origin}/`,
      lastModified: latestPostDate,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${origin}/tags`,
      lastModified: latestPostDate,
      changeFrequency: "weekly",
      priority: 0.5,
    },
  ];

  for (const post of posts) {
    entries.push({
      url: `${origin}/posts/${post.slug}`,
      lastModified: toLastModified(post.date),
      changeFrequency: "monthly",
      priority: 0.8,
    });
  }

  for (const { tag } of tags) {
    // 标签必须编码。注意这与 tags/[tag]/page.tsx 的 generateStaticParams 是两回事：
    // 那边返回**原文**（它决定磁盘上的文件名），这里编码（它是爬虫要请求的 URL）。
    // 搞混过一次，结果是标签页 404 —— 详见 .ai/modules/pages.md 里的记录。
    entries.push({
      url: `${origin}/tags/${encodeURIComponent(tag)}`,
      lastModified: latestPostDate,
      changeFrequency: "weekly",
      priority: 0.3,
    });
  }

  return entries;
}
