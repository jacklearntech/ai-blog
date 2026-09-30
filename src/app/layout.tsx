import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
// 站点地址的单一来源。这里刻意不写死域名 —— 硬编码一份副本正是 2026-09-30 那次
// 「RSS 全是死链却毫无症状」的成因，详见 scripts/generate-rss.ts 顶部注释与 ADR-005。
import siteConfig from "../../site.config.json";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // metadataBase 让下面 alternates 里的相对路径能解析成绝对 URL。
  // 同时它也是 Next 解析 Open Graph / canonical 等相对地址的基准。
  metadataBase: new URL(siteConfig.canonicalOrigin),
  title: {
    default: "Jack 的 AI Blog",
    template: "%s | Jack 的 AI Blog",
  },
  description: "关于 AI、技术与工程的博客。",
  alternates: {
    // 生成 <link rel="alternate" type="application/rss+xml" href=".../rss.xml">。
    // 作用是「自动发现」：读者把站点地址粘进阅读器时，阅读器靠这个标签找到订阅源，
    // 不必猜 /rss.xml 这个路径。页面上可见的订阅按钮走的是同一份文件。
    types: {
      "application/rss+xml": "/rss.xml",
    },
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Header />
        <main className="flex-1 max-w-3xl mx-auto px-6 py-12 w-full">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
