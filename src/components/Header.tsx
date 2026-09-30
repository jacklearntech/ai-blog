import Link from "next/link";
import RssIcon from "@/components/RssIcon";

/**
 * 站点页头。
 *
 * 两件事值得说明，因为都是有意为之、且以后容易被「顺手改坏」：
 *
 * 1. **这里的「Jack 的 AI Blog」是全站唯一的可见站名。** 首页正文曾经也渲染过一行同样的
 *    标题，结果首屏同一个名字出现两遍 —— 读者看到的是冗余，不是层次。现在首页的 h1
 *    改为 `sr-only`：视觉上让位给这一行，语义上仍然存在（详见 src/app/page.tsx）。
 * 2. **RSS 入口固定在右上角**，而不是只挂在首页正文里。订阅是「读到一半想订」的行为，
 *    所以入口要在每个页面都出现在同一个位置，而不是要求读者先回到首页。
 */
export default function Header() {
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="text-xl font-bold tracking-tight hover:opacity-80 transition-opacity">
          Jack 的 AI Blog
        </Link>
        <div className="flex items-center gap-4 sm:gap-6">
          <nav className="flex items-center gap-4 sm:gap-6 text-sm">
            <Link href="/" className="hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors">
              首页
            </Link>
            <Link href="/tags" className="hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors">
              标签
            </Link>
          </nav>
          {/* 相对路径 /rss.xml：同一份产物发到主站与镜像站都能正确解析 */}
          <a
            href="/rss.xml"
            aria-label="RSS 订阅"
            title="订阅 RSS 源（/rss.xml），用任意阅读器打开即可"
            className="inline-flex items-center gap-2 rounded-full border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:border-orange-400 hover:text-orange-600 dark:hover:border-orange-500/70 dark:hover:text-orange-400 transition-colors"
          >
            <RssIcon className="h-4 w-4 shrink-0 text-orange-500" />
            {/* 窄屏只留图标：与左侧站名挤在一行时容易折行，而图标配上 aria-label 依然可用 */}
            <span className="hidden sm:inline">RSS 订阅</span>
          </a>
        </div>
      </div>
    </header>
  );
}
