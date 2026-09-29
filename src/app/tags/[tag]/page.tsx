import { notFound } from "next/navigation";
import Link from "next/link";
import { getPostsByTag, getAllTags } from "@/lib/posts";
import PostCard from "@/components/PostCard";

// 注意：generateStaticParams 的返回值会被 Next 直接当作**输出文件名**的一部分。
// 之前这里返回 encodeURIComponent(tag)，于是磁盘上落成字面的
//   out/tags/Claude%20Code.html
// 而访问 /tags/Claude%20Code 时，托管方（nginx / Vercel / 任意静态服务器）
// 会先把 URL 解码成 /tags/Claude Code 再去找文件 → 找不到 → 404。
// 返回标签原文后落盘为 out/tags/Claude Code.html，与解码后的请求路径一致。
// 链接一侧仍必须编码（见 TagList.tsx），那是 URL 的职责，两者并不冲突。
export function generateStaticParams() {
  const tags = getAllTags();
  return tags.map(({ tag }) => ({ tag }));
}

// 参数可能是原文，也可能是编码形态（取决于 Next 的版本与调用路径），两种都兜住。
// 直接调用 decodeURIComponent 会在标签含字面百分号时抛 URIError。
function normalizeTagParam(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params;
  const decodedTag = normalizeTagParam(tag);
  return {
    title: `#${decodedTag}`,
    description: `标签 "${decodedTag}" 下的文章`,
  };
}

export default async function TagPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params;
  const decodedTag = normalizeTagParam(tag);
  const posts = getPostsByTag(decodedTag);

  if (posts.length === 0) notFound();

  return (
    <div>
      <div className="mb-10">
        <Link
          href="/tags"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors mb-4"
        >
          &larr; 所有标签
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">#{decodedTag}</h1>
        <p className="mt-2 text-zinc-500 dark:text-zinc-400">
          共 {posts.length} 篇文章
        </p>
      </div>
      <div className="space-y-10">
        {posts.map((post) => (
          <PostCard key={post.slug} post={post} />
        ))}
      </div>
    </div>
  );
}
