import { test, type Page, type Locator } from "@playwright/test";
import fse from "fs-extra";
import { BlockCrawler, type PageContext, type CrawlerConfig } from "../src";

/**
 * shadcndesign 爬虫 - 继承 BlockCrawler 并重写 getTabSection 方法
 */
class ShadcnCrawler extends BlockCrawler {
  protected getTabSection(page: Page, tabText: string): Locator {
    // shadcndesign 使用 tabpanel 而不是 section
    return page.getByRole("tabpanel", { name: tabText });
  }
}

test("shadcndesign", async ({ page }) => {
  // 设置超时
  test.setTimeout(60 * 1000); // 1 分钟

  // 创建 shadcndesign 爬虫实例
  const crawler = new ShadcnCrawler({
    startUrl: "https://www.shadcndesign.com/pro-blocks",
    maxConcurrency: 5,
    // shadcndesign 的定位符配置
    collectionLinkLocator: "role=link", // 在 tabpanel 中查找链接
    collectionNameLocator: '[data-slot="card-title"]', // 通过 data-slot 找到标题
    collectionCountLocator: "p", // 通过 p 标签找到数量文本
  } as CrawlerConfig);

  // 设置页面处理器并自动运行
  await crawler.onPage(page, async ({ outputDir }: PageContext) => {
    const names = await getPageBlockNames(page);
    // 输出到文件
    await fse.outputFile(
      `${outputDir}/shadcndesign-blocks-names.json`,
      JSON.stringify(names, null, 2)
    );
  });
});

// 获取页面中所有 blocks 路径
async function getPageBlockNames(page: Page) {
  const links = await page
    .getByRole("link", { name: "Open preview in fullscreen" })
    .all();

  const names = await Promise.all(
    links.map(async (link) => {
      const href = await link.getAttribute("href");
      // 取最后一段
      const name = href ? href.split("/").pop() : "";
      console.log(`🔍 name: ${name}`);
      return name;
    })
  );
  return names;
}
