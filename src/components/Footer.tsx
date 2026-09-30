import RssIcon from "@/components/RssIcon";

export default function Footer() {
  return (
    <footer className="border-t border-zinc-200 dark:border-zinc-800 mt-auto">
      <div className="max-w-3xl mx-auto px-6 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
        <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <span>&copy; {new Date().getFullYear()} Jack 的 AI Blog. 使用 Next.js 构建。</span>
          <a
            href="/rss.xml"
            className="inline-flex items-center gap-1.5 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
          >
            <RssIcon className="h-3.5 w-3.5 shrink-0 text-orange-500" />
            RSS 订阅
          </a>
        </p>
        <p className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 px-4">
          <a
            href="https://beian.miit.gov.cn/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
          >
            苏ICP备2026061223号
          </a>
          <a
            href="https://www.beian.gov.cn/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
          >
            沪公网安备31010902101571号
          </a>
        </p>
      </div>
    </footer>
  );
}
