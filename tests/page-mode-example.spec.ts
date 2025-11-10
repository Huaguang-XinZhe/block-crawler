import { test } from "@playwright/test";
import fse from "fs-extra";
import { BlockCrawler, type PageContext } from "../src";

/**
 * 页面处理模式示例
 * 展示如何使用框架处理单个页面（不分 Block）
 */

test("使用页面处理模式爬取", async ({ page }) => {
  // 设置超时
  test.setTimeout(2 * 60 * 1000);

  // 创建爬虫实例，不传 blockLocator 启用页面处理模式
  const crawler = new BlockCrawler({
    startUrl: "https://example.com/components",
    tabListAriaLabel: "Categories",
    maxConcurrency: 3,
    outputDir: "output-pages",
    configDir: ".crawler-pages",
    // 不传 blockLocator，使用页面处理模式
    enableProgressResume: true,
  });

  // 设置页面处理器
  crawler.onPage(async (context: PageContext) => {
    const { page, currentPath, outputDir } = context;

    console.log(`\n🔍 正在处理页面: ${currentPath}`);

    // 自定义页面处理逻辑
    // 例如：提取页面标题
    const title = await page.title();
    
    // 提取页面内容
    const content = await page.locator("main").textContent();
    
    // 提取所有图片链接
    const images = await page.locator("img").evaluateAll((imgs) =>
      imgs.map((img) => (img as HTMLImageElement).src)
    );

    // 保存结果
    const result = {
      title,
      content: content?.slice(0, 500), // 只保存前 500 字符
      images,
      timestamp: new Date().toISOString(),
    };

    await fse.outputFile(
      `${outputDir}/${currentPath}/page-data.json`,
      JSON.stringify(result, null, 2)
    );

    console.log(`✅ 页面处理完成: ${currentPath}`);
  });

  // 运行爬虫
  await crawler.run(page);
});

