import { getAllPosts } from "@/lib/posts";
import PostCard from "@/components/PostCard";
import RssIcon from "@/components/RssIcon";

export default function HomePage() {
  const posts = getAllPosts();

  return (
    <div className="space-y-12">
      <section>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 mb-2">
          <h1 className="text-3xl font-bold tracking-tight">Jack 的 AI Blog</h1>
          {/* 订阅入口放在标题右侧：这是读者视野里第一处、也是最容易被找到的位置 */}
          <a
            href="/rss.xml"
            title="订阅 RSS 源（/rss.xml），用任意阅读器打开即可"
            className="inline-flex items-center gap-2 rounded-full border border-zinc-200 dark:border-zinc-800 px-4 py-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:border-orange-400 hover:text-orange-600 dark:hover:border-orange-500/70 dark:hover:text-orange-400 transition-colors"
          >
            <RssIcon className="h-4 w-4 shrink-0 text-orange-500" />
            RSS 订阅
          </a>
        </div>
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
