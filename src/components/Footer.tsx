export default function Footer() {
  return (
    <footer className="border-t border-zinc-200 dark:border-zinc-800 mt-auto">
      <div className="max-w-3xl mx-auto px-6 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
        <p>&copy; {new Date().getFullYear()} Jack 的 AI Blog. 使用 Next.js 构建。</p>
        <p className="mt-2">
          <a
            href="https://beian.miit.gov.cn/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
          >
            苏ICP备2026061223号
          </a>
        </p>
      </div>
    </footer>
  );
}
