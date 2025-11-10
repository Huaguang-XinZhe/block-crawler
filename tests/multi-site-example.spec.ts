import { test } from "@playwright/test";
import { BlockCrawler } from "../src";

/**
 * 多站点爬取示例
 * 展示如何在同一项目中爬取多个网站
 * 每个网站的进度文件会根据 startUrl 自动生成
 */

test("爬取网站 A", async ({ page }) => {
  test.setTimeout(2 * 60 * 1000);

  const crawlerA = new BlockCrawler({
    startUrl: "https://site-a.com/components",
    blockLocator: "xpath=//main/div",
    maxConcurrency: 5,
  });

  // 进度文件将自动保存到：.crawler/progress-site-a-com-xxxxxxxx.json

  crawlerA.onBlock(async (context) => {
    console.log(`[Site A] 处理: ${context.blockName}`);
    // 处理逻辑...
  });

  await crawlerA.run(page);
});

test("爬取网站 B", async ({ page }) => {
  test.setTimeout(2 * 60 * 1000);

  const crawlerB = new BlockCrawler({
    startUrl: "https://site-b.com/library",
    blockLocator: ".component-block",
    maxConcurrency: 3,
    outputDir: "output-site-b",
  });

  // 进度文件将自动保存到：.crawler/progress-site-b-com-yyyyyyyy.json

  crawlerB.onBlock(async (context) => {
    console.log(`[Site B] 处理: ${context.blockName}`);
    // 处理逻辑...
  });

  await crawlerB.run(page);
});

test("爬取网站 C - 不同路径", async ({ page }) => {
  test.setTimeout(2 * 60 * 1000);

  const crawlerC = new BlockCrawler({
    startUrl: "https://site-a.com/gallery", // 同一域名，不同路径
    blockLocator: ".gallery-item",
  });

  // 进度文件将自动保存到：.crawler/progress-site-a-com-zzzzzzzz.json
  // 注意：与网站 A 的进度文件不同，因为路径不同

  crawlerC.onBlock(async (context) => {
    console.log(`[Site C] 处理: ${context.blockName}`);
    // 处理逻辑...
  });

  await crawlerC.run(page);
});

