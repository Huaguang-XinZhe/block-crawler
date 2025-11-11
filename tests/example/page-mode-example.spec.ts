import { test } from "@playwright/test";
import fse from "fs-extra";
import { BlockCrawler, type PageContext } from "../../src";

/**
 * 页面处理模式示例
 * 展示如何使用框架处理单个页面（不分 Block）
 */

test("使用页面处理模式爬取", async ({ page }) => {
  // 设置超时
  test.setTimeout(2 * 60 * 1000);

  // 创建爬虫实例，不调用 onBlock 即为页面处理模式
  const crawler = new BlockCrawler({
    startUrl: "https://example.com/components",
    tabListAriaLabel: "Categories",
    maxConcurrency: 3,
    outputDir: "output-pages",
    configDir: ".crawler-pages",
    enableProgressResume: true,
    // 必需的链接收集定位符
    collectionLinkLocator: "a",
    collectionNameLocator: ".name",
    collectionCountLocator: ".count",
  });

  // 设置页面处理器并自动运行
  await crawler.onPage(page, async (context: PageContext) => {
    const { currentPage, currentPath, outputDir } = context;

    console.log(`\n🔍 正在处理页面: ${currentPath}`);

    // 自定义页面处理逻辑（使用 currentPage，它可能是 newPage）
    // 例如：提取页面标题
    const title = await currentPage.title();
    
    // 提取页面内容
    const content = await currentPage.locator("main").textContent();
    
    // 提取所有图片链接
    const images = await currentPage.locator("img").evaluateAll((imgs) =>
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
});

