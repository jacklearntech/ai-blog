import Link from "next/link";
import type { PostMeta } from "@/lib/posts";

export default function PostCard({ post }: { post: PostMeta }) {
  const date = new Date(post.date).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <article className="group">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
          <time dateTime={post.date}>{date}</time>
          {post.tags && post.tags.length > 0 && (
            <div className="flex gap-1.5">
              {post.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/tags/${encodeURIComponent(tag)}`}
                  className="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  {tag}
                </Link>
              ))}
            </div>
          )}
        </div>
        <h2 className="text-xl font-semibold tracking-tight">
          <Link
            href={`/posts/${post.slug}`}
            className="group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors"
          >
            {post.title}
          </Link>
        </h2>
        {post.summary && (
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed line-clamp-2">
            {post.summary}
          </p>
        )}
      </div>
    </article>
  );
}
