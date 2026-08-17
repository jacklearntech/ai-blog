import Link from "next/link";

export default function Header() {
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold tracking-tight hover:opacity-80 transition-opacity">
          Jack 的 AI Blog
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/" className="hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors">
            首页
          </Link>
          <Link href="/tags" className="hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors">
            标签
          </Link>
        </nav>
      </div>
    </header>
  );
}
