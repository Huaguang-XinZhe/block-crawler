import { test, type Page } from "@playwright/test";
import fse from "fs-extra";
import { BlockCrawler, type PageContext } from "block-crawler";

test("shadcndesign", async ({ page }) => {
  // 设置超时
  test.setTimeout(60 * 1000); // 1 分钟

  // 创建 shadcndesign 爬虫实例（使用配置函数，无需继承）
  const crawler = new BlockCrawler(page, {
    startUrl: "https://www.shadcndesign.com/pro-blocks",
    maxConcurrency: 5,
    enableProgressResume: false,
    startUrlWaitOptions: {
      waitUntil: "domcontentloaded",
    },
    // getTabSection 配置（如果不需要点击 tab 切换，可以使用 getAllTabTexts 代替）
    getTabSection: (page, tabText) => page.getByRole("tabpanel", { name: tabText }),
    
    // 可选：如果网站的所有 tab 内容都在页面上，无需点击切换，可以配置 getAllTabTexts
    // getAllTabTexts: async (page) => {
    //   const tabs = await page.getByRole("tab").all();
    //   return Promise.all(tabs.map(tab => tab.textContent() || ""));
    // },
    
    collectionNameLocator: '[data-slot="card-title"]', // 通过 data-slot 找到标题
    collectionCountLocator: "p", // 通过 p 标签找到数量文本
  });

  // 改为 Set
  const names: Set<string> = new Set();

  // 设置页面处理器并自动运行
  await crawler
    .pages()
    .each(async ({ currentPage }: PageContext) => {
      const blockNames = await getPageBlockNames(currentPage);
      blockNames.forEach(name => names.add(name));
    });

  // 输出到文件
  await fse.outputFile(
    `${crawler.outputDir}/shadcndesign-blocks-names.json`,
    JSON.stringify(Array.from(names), null, 2)
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
