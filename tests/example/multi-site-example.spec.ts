import { test } from "@playwright/test";
import { BlockCrawler } from "../../src";

/**
 * 多站点爬取示例
 * 展示如何在同一项目中爬取多个网站
 * 每个网站的进度文件会根据 startUrl 自动生成
 */

test("爬取网站 A", async ({ page }) => {
  test.setTimeout(2 * 60 * 1000);

  const crawlerA = new BlockCrawler({
    startUrl: "https://site-a.com/components",
    maxConcurrency: 5,
    collectionLinkLocator: "a",
    collectionNameLocator: ".name",
    collectionCountLocator: ".count",
  });

  // 进度文件将自动保存到：.crawler/progress-site-a-com-xxxxxxxx.json
  // 输出目录将自动设置为：output/site-a-com-xxxxxx

  await crawlerA.onBlock(page, "xpath=//main/div", async (context) => {
    console.log(`[Site A] 处理: ${context.blockName}`);
    // 处理逻辑...
  });
});

test("爬取网站 B", async ({ page }) => {
  test.setTimeout(2 * 60 * 1000);

  const crawlerB = new BlockCrawler({
    startUrl: "https://site-b.com/library",
    maxConcurrency: 3,
    outputDir: "output-site-b", // 自定义输出目录
    collectionLinkLocator: "a",
    collectionNameLocator: ".name",
    collectionCountLocator: ".count",
  });

  // 进度文件将自动保存到：.crawler/progress-site-b-com-yyyyyyyy.json
  // 输出目录使用自定义：output-site-b

  await crawlerB.onBlock(page, ".component-block", async (context) => {
    console.log(`[Site B] 处理: ${context.blockName}`);
    // 处理逻辑...
  });
});

test("爬取网站 C - 不同路径", async ({ page }) => {
  test.setTimeout(2 * 60 * 1000);

  const crawlerC = new BlockCrawler({
    startUrl: "https://site-a.com/gallery", // 同一域名，不同路径
    collectionLinkLocator: "a",
    collectionNameLocator: ".name",
    collectionCountLocator: ".count",
  });

  // 进度文件将自动保存到：.crawler/progress-site-a-com-zzzzzzzz.json
  // 输出目录将自动设置为：output/site-a-com-zzzzzz
  // 注意：与网站 A 的进度文件和输出目录都不同，因为路径不同

  await crawlerC.onBlock(page, ".gallery-item", async (context) => {
    console.log(`[Site C] 处理: ${context.blockName}`);
    // 处理逻辑...
  });
});

