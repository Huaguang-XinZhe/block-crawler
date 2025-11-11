import { test, type Page } from "@playwright/test";
import * as fse from "fs-extra";
import { BlockCrawler, type PageContext } from "ui-blocks-crawler";

test("shadcndesign", async ({ page }) => {
  // 设置超时
  test.setTimeout(60 * 1000); // 1 分钟

  // 创建 shadcndesign 爬虫实例（使用配置函数，无需继承）
  const crawler = new BlockCrawler({
    startUrl: "https://www.shadcndesign.com/pro-blocks",
    maxConcurrency: 5,
    enableProgressResume: false,
    startUrlWaitOptions: {
      waitUntil: "domcontentloaded",
    },
    // 方式 1：使用 getTabSection 函数配置（推荐）
    getTabSection: (page, tabText) => page.getByRole("tabpanel", { name: tabText }),
    // 方式 2：使用 tabSectionLocator 字符串（简单场景）
    // 注意：这一步极有可能出错，第一个 tab 的 name（text）和第二个 tab 的 name（aria-labelledby）来自不同的地方
    // 最好还是通过 getByRole 配置对象中的 name 指定
    // tabSectionLocator: '[role="tabpanel"]:has-text("{tabText}")',
    collectionLinkLocator: "role=link", // 在 tabpanel 中查找链接
    collectionNameLocator: '[data-slot="card-title"]', // 通过 data-slot 找到标题
    collectionCountLocator: "p", // 通过 p 标签找到数量文本
  });

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
