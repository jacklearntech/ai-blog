/**
 * 构建产物路径守卫 —— 在 `npm run build` 链路的最后执行。
 *
 * 为什么需要它
 * ------------
 * Next.js 静态导出时，`generateStaticParams` 返回的值会被**直接当作输出文件名**。
 * 一旦某个路由参数被提前转义过，磁盘上就会落下字面的转义名：
 *
 *     out/tags/Claude%20Code.html
 *
 * 而浏览器访问 `/tags/Claude%20Code` 时，任何静态托管方（nginx / Vercel / 任意 CDN）
 * 都会先把 URL 解码成 `/tags/Claude Code`，再拿这个路径去匹配文件 —— 找不到，于是 404。
 *
 * 更隐蔽的是：纯 ASCII 路由编码前后完全一致，会把这个错误完美掩盖。
 * 所以「站点看起来全绿」和「部分链接 404」可以同时成立，靠人眼审查发现不了。
 *
 * 这个脚本在构建之后扫描 out/：
 *   - 只要发现任何路径名含 `%`，就**让构建失败**并指出可疑来源；
 *   - 同时列出含空格或非 ASCII 的路径，提示这些 URL 上线后必须逐个实测（不算失败）。
 *
 * 于是这类问题不可能再被悄悄部署出去。
 *
 * 用法：
 *     npx tsx scripts/check-export-paths.ts [产物目录]     # 默认 out
 */

import fs from "fs";
import path from "path";

// 允许传入目录，便于单独测试这个守卫本身
const OUT_DIR = process.argv[2] ?? "out";

/** 需要在部署后实测的路径上限（超出只打印前 N 条，避免刷屏） */
const EXOTIC_PRINT_LIMIT = 20;

interface ScanResult {
  /** 路径名含 % —— 判定为失败 */
  escaped: string[];
  /** 路径名含空格或非 ASCII —— 提醒实测 */
  exotic: string[];
  /** 扫描到的路径总数 */
  total: number;
}

function scan(dir: string, acc: ScanResult): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);

    if (entry.name.includes("%")) acc.escaped.push(full);
    if (/[\s]/.test(entry.name) || /[^\x20-\x7e]/.test(entry.name)) acc.exotic.push(full);

    acc.total += 1;
    if (entry.isDirectory()) scan(full, acc);
  }
}

function main(): void {
  if (!fs.existsSync(OUT_DIR)) {
    console.error(`[check-export-paths] 找不到产物目录 ${OUT_DIR}/，请先执行 next build`);
    process.exit(1);
  }

  const acc: ScanResult = { escaped: [], exotic: [], total: 0 };
  scan(OUT_DIR, acc);

  console.log(`[check-export-paths] 已扫描 ${acc.total} 个路径`);

  if (acc.exotic.length > 0) {
    console.log(
      `[check-export-paths] 提示：${acc.exotic.length} 个路径含空格或非 ASCII，` +
        `上线后必须用浏览器会发出的编码形态逐个实测：`
    );
    for (const p of acc.exotic.slice(0, EXOTIC_PRINT_LIMIT)) console.log(`    ${p}`);
    if (acc.exotic.length > EXOTIC_PRINT_LIMIT) {
      console.log(`    …另有 ${acc.exotic.length - EXOTIC_PRINT_LIMIT} 个`);
    }
  }

  if (acc.escaped.length > 0) {
    console.error("");
    console.error(
      `[check-export-paths] 失败：产物里有 ${acc.escaped.length} 个路径名含 %，` +
        `说明某个路由参数在生成静态参数时被提前转义了。`
    );
    for (const p of acc.escaped) console.error(`    ${p}`);
    console.error("");
    console.error("  最常见的来源：generateStaticParams 里对参数调用了 encodeURIComponent。");
    console.error("  这个返回值会被 Next 直接当作输出文件名，因此必须返回原始值：");
    console.error("      return tags.map(({ tag }) => ({ tag }));                          // 对");
    console.error("      return tags.map(({ tag }) => ({ tag: encodeURIComponent(tag) })); // 错");
    console.error("  链接一侧（<Link href>）仍应保留 encodeURIComponent —— 那是 URL 的职责，两者不冲突。");
    process.exit(1);
  }

  console.log("[check-export-paths] 通过：产物中没有被转义的文件名");
}

main();
