# Jack 的 AI Blog

这是我的个人技术博客，主要记录 AI、软件工程和技术探索方面的内容。

整个站点用 [Next.js](https://nextjs.org/) + [Tailwind CSS v4](https://tailwindcss.com/) + [MDX](https://mdxjs.com/) 搭建，构建后是纯静态 HTML，部署在 Vercel 上。

## 本地跑起来

```bash
npm install        # 装依赖
npm run dev        # 启动开发服务器，访问 http://localhost:3000
npm run build      # 构建静态站点 + 生成 RSS
npm start          # 预览构建产物
```

## 怎么写文章

在 `content/` 目录下新建一个 `.mdx` 文件就行，文件名就是文章的 URL slug。文件开头用 YAML frontmatter 写元信息：

```mdx
---
title: "文章标题"
date: "2026-08-17"
summary: "首页列表里显示的简短描述"
tags: ["ai", "教程"]
draft: false
---

正文内容写在这里，支持完整的 Markdown 语法，还能嵌入 React 组件...
```

### frontmatter 字段说明

| 字段        | 必填 | 说明                                     |
| ----------- | ---- | ---------------------------------------- |
| `title`     | 是   | 文章标题                                 |
| `date`      | 是   | 发布日期，格式 YYYY-MM-DD                |
| `summary`   | 否   | 摘要，显示在首页文章列表里               |
| `tags`      | 否   | 标签数组，用于分类和导航                 |
| `draft`     | 否   | 设为 `true` 就不会出现在生产构建中       |

## 项目结构

```
content/          # MDX 文章放这里
src/app/          # Next.js 页面（App Router）
src/components/   # React 组件
src/lib/          # 工具函数（文章解析等）
scripts/          # 构建脚本（RSS 生成）
public/           # 静态资源
.ai/              # 项目文档（架构、模块说明、决策记录）
```

## 部署

项目使用静态导出（`output: 'export'`），可以部署到任何支持静态文件的地方：

- **Vercel**：关联 GitHub 仓库后自动部署，push 即更新
- **GitHub Pages**：把输出目录设为 `out/`
- **其他静态托管**：直接把 `out/` 目录上传即可

### 环境变量

| 变量         | 说明                          | 示例                              |
| ------------ | ----------------------------- | --------------------------------- |
| `SITE_URL`   | 站点域名，用于生成 RSS 链接   | `https://ai-blog-vercel.jacklearn.tech` |

## License

MIT
