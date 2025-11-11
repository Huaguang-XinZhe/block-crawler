import { test, type Locator, type Page } from "@playwright/test";
import fse from "fs-extra";
import { BlockCrawler, type BlockContext } from "../../src";
import { extractCodeFromBlock } from "../utils/extract-code";

/**
 * 使用新框架重构后的爬虫示例
 * 展示如何使用 BlockCrawler 框架来爬取组件
 * 
 * 方式 1：使用配置函数（推荐）
 * 方式 2：继承 BlockCrawler 并重写 getTabSection 方法
 */
test("使用 BlockCrawler 框架爬取组件", async ({ page }) => {
  // 设置超时
  test.setTimeout(2 * 60 * 1000);

  // 创建 heroui 爬虫实例，配置化参数
  const crawler = new BlockCrawler({
    startUrl: "https://pro.mufengapp.cn/components",
    tabListAriaLabel: "Categories",
    maxConcurrency: 5,
    outputDir: "output",
    enableProgressResume: true,
    // 方式 1：使用 getTabSection 函数配置（推荐）
    getTabSection: (page, tabText) => 
      page.locator("section").filter({ has: page.getByRole("heading", { name: tabText }) }),
    // 链接收集定位符（必需配置）
    collectionLinkLocator: "section > a",
    collectionNameLocator: "xpath=/div[2]/div[1]/div[1]",
    collectionCountLocator: "xpath=/div[2]/div[1]/div[2]",
  });

  // 设置 Block 处理器并自动运行
  // blockSectionLocator 作为参数传入（Block 模式必需）
  await crawler.onBlock(
    page,
    "xpath=//main/div/div/div",
    async ({ currentPage, block, blockPath, outputDir }: BlockContext) => {
    // 点击切换到 Code
    await clickCodeTab(block);

    // 获取 ts 部分代码
    await saveAllLanguageFiles(block, blockPath, outputDir, "ts");

    // 切换 js
    await block
      .getByRole("button", { name: "TypeScript Change theme" })
      .click();
    // 这里不能用 block 去找，必须用 currentPage，因为它被传送到了 body 下❗
    await currentPage.getByRole("option", { name: "JavaScript" }).click();

    // 切换后，得延迟一会儿，不然 fileTabs 还是之前的
    await currentPage.waitForTimeout(500);

    // 获取 js 部分代码
    await saveAllLanguageFiles(block, blockPath, outputDir, "js");
  });
});

// ========== 辅助函数 ==========

// 点击 Code（至关重要，有时候没反应❗），如果超时再点击一次
async function clickCodeTab(block: Locator) {
  const codeTab = block.getByRole("tab", { name: "Code" });
  await codeTab.click();
  try {
    // 等待 App.tsx 出现（成功即继续）
    await block
      .getByText("App.tsx")
      .waitFor({ state: "visible", timeout: 1500 });
  } catch (e) {
    // 超时未出现，继续再点击一次
    console.warn("⚠️ Code tab first click timeout, retrying...");
    await codeTab.click();
    // 再等一次，如果这次还没出来就抛错
    await block
      .getByText("App.tsx")
      .waitFor({ state: "visible", timeout: 3000 });
  }
}

// 保存当前语言版本的所有文件代码到指定目录
async function saveAllLanguageFiles(
  block: Locator,
  blockPath: string,
  outputDir: string,
  language: "ts" | "js"
) {
  // 复制当前文件的内容
  const fileTabs = await block
    .getByRole("tablist", {
      name: "Select active file",
    })
    .getByRole("tab")
    .all();

  // 遍历所有文件标签
  for (let i = 0; i < fileTabs.length; i++) {
    const fileTab = fileTabs[i];

    if (i != 0) {
      // 点击切换到文件 Tab
      await fileTab.click();
    }

    const fileName = await fileTab.textContent();
    // 使用封装的代码提取函数，避免重复内容和格式问题
    const code = await extractCodeFromBlock(block);

    // 输出到文件
    if (fileName) {
      await fse.outputFile(
        `${outputDir}/${blockPath}/${language}/${fileName}`,
        code
      );
    } else {
      console.warn("fileName is null");
    }
  }
}
