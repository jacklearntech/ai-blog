import Link from "next/link";

interface TagListProps {
  tags: { tag: string; count: number }[];
}

export default function TagList({ tags }: TagListProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map(({ tag, count }) => (
        <Link
          key={tag}
          href={`/tags/${encodeURIComponent(tag)}`}
          className="inline-flex items-center gap-1.5 text-sm bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
        >
          <span>{tag}</span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{count}</span>
        </Link>
      ))}
    </div>
  );
}
