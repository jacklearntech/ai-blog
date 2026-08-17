import { notFound } from "next/navigation";
import Link from "next/link";
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { compileMDX } from "next-mdx-remote/rsc";
import rehypePrettyCode from "rehype-pretty-code";
import { getPostBySlug, getAllPosts } from "@/lib/posts";

const contentDirectory = path.join(process.cwd(), "content");

export function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};

  return {
    title: post.title,
    description: post.summary,
  };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) notFound();

  const filePath = path.join(contentDirectory, `${slug}.mdx`);
  const source = fs.readFileSync(filePath, "utf-8");
  const { content } = matter(source);

  const { content: MDXContent } = await compileMDX({
    source: content,
    options: {
      mdxOptions: {
        rehypePlugins: [
          [rehypePrettyCode, { theme: "github-dark", keepBackground: true }],
        ],
      },
    },
  });

  const date = new Date(post.date).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <article>
      <header className="mb-10">
        <div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400 mb-4">
          <time dateTime={post.date}>{date}</time>
          {post.tags && post.tags.length > 0 && (
            <div className="flex gap-1.5">
              {post.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/tags/${encodeURIComponent(tag)}`}
                  className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  {tag}
                </Link>
              ))}
            </div>
          )}
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{post.title}</h1>
        {post.summary && (
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {post.summary}
          </p>
        )}
      </header>
      <div className="prose">
        {MDXContent}
      </div>
      <hr className="my-12 border-zinc-200 dark:border-zinc-800" />
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
      >
        &larr; 返回文章列表
      </Link>
    </article>
  );
}
