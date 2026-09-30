/**
 * RSS 图标 —— 内联 SVG，不引入任何图标库。
 *
 * 为什么手写：这个站点的依赖清单刻意保持很小，为了一个图标去装
 * 一整套图标包（且会在客户端 bundle 里带上一堆 tree-shaking 不掉的导出）
 * 不划算。用 currentColor 上色，因此颜色由调用方的 class 决定。
 *
 * 标记为装饰性图形（aria-hidden），可访问名称由旁边可见的文字承担 ——
 * 屏幕阅读器读「RSS 订阅」比读「rss icon」更有意义。
 */
export default function RssIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 11a9 9 0 0 1 9 9" />
      <path d="M4 4a16 16 0 0 1 16 16" />
      <circle cx="5" cy="19" r="1" />
    </svg>
  );
}
