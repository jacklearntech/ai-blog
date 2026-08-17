import { getAllTags } from "@/lib/posts";
import TagList from "@/components/TagList";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "标签",
  description: "按标签浏览文章。",
};

export default function TagsPage() {
  const tags = getAllTags();

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight mb-8">标签</h1>
      {tags.length > 0 ? (
        <TagList tags={tags} />
      ) : (
        <p className="text-zinc-500 dark:text-zinc-400">暂无标签。</p>
      )}
    </div>
  );
}
