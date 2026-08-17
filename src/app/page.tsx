import { getAllPosts } from "@/lib/posts";
import PostCard from "@/components/PostCard";

export default function HomePage() {
  const posts = getAllPosts();

  return (
    <div className="space-y-12">
      <section>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Jack 的 AI Blog</h1>
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
