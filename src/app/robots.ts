import type { MetadataRoute } from "next";

/**
 * /robots.txt —— 由 App Router 的「元数据路由」在构建期生成到 out/robots.txt。
 *
 * 为什么不用 public/robots.txt
 * ---------------------------
 * 1. 这个仓库里 `public/` does not exist（favicon 走 src/app/favicon.ico 约定）。
 *    为两行内容新建一个目录、并把它变成「静态资源就该放这儿」的既有印象，是给以后的人挖坑。
 * 2. **更要紧的一条**：`ops/release.sh` 的提交白名单（DEFAULT_ADD_PATHS）里没有 public ——
 *    放在那里的文件会在服务器上正常生效，却**永远不会被推到 GitHub**。
 *    「线上是对的、备份里没有」是最难发现的一类失败，所以从一开始就别走那条路。
 *    元数据路由两边都躲开：它是源码，而 src/ 在白名单里。
 *
 * 为什么内容只有「全部允许」
 * -------------------------
 * 这是个公开博客：没有后台、没有接口、没有需要藏起来的路径。唯一不希望被抓的东西
 * （扫描器、漏洞探测路径、空 UA）已经在 nginx 层返回 444 —— 那些不该写进 robots.txt。
 * robots.txt 是**对善意爬虫的请求**，不是访问控制；把防护写在这里只会把规则告诉对手。
 *
 * 暂不声明 Sitemap 指令
 * --------------------
 * 本站还没有 sitemap.xml。指向一个不存在的文件比不写更糟 —— 爬虫会反复请求 404，
 * 而这个项目刚刚才因为「同一个事实的错误副本」吃过一次亏（ADR-005）。
 * 等真的有了 sitemap，再在这里加一行，并且地址要从 site.config.json 取。
 */
/**
 * **这一行不是可选的。** 在 `output: 'export'` 下，元数据路由默认被当作可能动态渲染的
 * Route Handler 处理，构建会直接报错：
 *     Error: export const dynamic = "force-static"/export const revalidate not configured
 *            on route "/robots.txt" with "output: export"
 * 声明 force-static 等于告诉 Next「构建期算一次、写成文件」，这正是静态导出需要的形式。
 * 以后再加 sitemap.ts / manifest.ts 之类的元数据路由，同样要带上这一行。
 */
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
  };
}
