import { test, type Page } from "@playwright/test";
import fse from "fs-extra";
import { BlockCrawler, type PageContext, type CrawlerConfig } from "../src";

test("shadcndesign", async ({ page }) => {
  // 设置超时
  test.setTimeout(60 * 1000); // 1 分钟

  // 创建 shadcndesign 爬虫实例（使用配置方式，无需继承）
  const crawler = new BlockCrawler({
    startUrl: "https://www.shadcndesign.com/pro-blocks",
    maxConcurrency: 5,
    enableProgressResume: false,
    startUrlWaitOptions: {
      waitUntil: "domcontentloaded",
    },
    // shadcndesign 的定位符配置
    tabSectionLocator: '[role="tabpanel"]:has-text("{tabText}")', // 配置 tabSection 定位符
    collectionLinkLocator: "role=link", // 在 tabpanel 中查找链接
    collectionNameLocator: '[data-slot="card-title"]', // 通过 data-slot 找到标题
    collectionCountLocator: "p", // 通过 p 标签找到数量文本
  } as CrawlerConfig);

  const names: string[] = [];

  // 设置页面处理器并自动运行
  await crawler.onPage(
    page,
    async ({ currentPage }: PageContext) => {
      const blockNames = await getPageBlockNames(currentPage);
      names.push(...blockNames);
    }
  );

  // 输出到文件
  await fse.outputFile(
    `${crawler.outputDir}/shadcndesign-blocks-names.json`,
    JSON.stringify(names, null, 2)
  );
});

// 获取页面中所有 blocks 路径
async function getPageBlockNames(page: Page) {
  const links = await page
    .getByRole("link", { name: "Open preview in fullscreen" })
    .all();

  const names = await Promise.all(
    links.map(async (link) => {
      const href = await link.getAttribute("href");
      const name = href ? href.split("/").pop() : "";
      if (name) {
        console.log(`🔍 name: ${name}`);
        return name;
      }
      return null;
    })
  );

  // 用循环
  // const names: string[] = [];
  // for (const link of links) {
  //   const href = await link.getAttribute("href");
  //   const name = href ? href.split("/").pop() : "";
  //   if (name) {
  //     names.push(name);
  //     console.log(`🔍 name: ${name}`);
  //   }
  // }

  return names.filter((name) => name !== null);
}
