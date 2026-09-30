import { getAllPosts } from "@/lib/posts";
import PostCard from "@/components/PostCard";

/**
 * 首页。
 *
 * **这里刻意没有可见的页面标题。** 站名「Jack 的 AI Blog」已经在页头（src/components/Header.tsx）
 * 出现一次，首屏再渲染一遍同一个名字，读者看到的是重复而不是层次。
 *
 * 但 h1 不能删 —— 它是这个页面的语义主标题：屏幕阅读器靠它建立大纲，搜索引擎靠它判断主题。
 * 所以保留为 `sr-only`：**视觉上让位给页头，语义上仍然完整**。
 * 想「只留一行站名」的正确做法是这一种，而不是把 h1 整段删掉。
 *
 * RSS 订阅按钮也已从这里移到页头右上角：订阅是「读到一半想订」的动作，
 * 入口应当在每个页面都出现在同一位置（见 src/components/Header.tsx）。
 */
export default function HomePage() {
  const posts = getAllPosts();

  return (
    <div className="space-y-12">
      <section>
        <h1 className="sr-only">Jack 的 AI Blog</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mb-10">
          关于 AI、技术与工程的思考与记录。
        </p>
        <div className="space-y-10">
          {posts.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
        {posts.length === 0 && (
          <p className="text-zinc-500 dark:text-zinc-400">暂无文章。</p>
        )}
      </section>
    </div>
  );
}
