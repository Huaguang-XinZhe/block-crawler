import { test, type Page, type Locator } from "@playwright/test";
import fse from "fs-extra";
import { BlockCrawler } from "block-crawler";
import { extractCodeFromBlock } from "./utils/extract-code";

test("heroui-pro crawler", async ({ page }) => {
  // 设置超时
  test.setTimeout(2 * 60 * 1000); // 2 分钟

  const crawler = new BlockCrawler(page, {
    startUrl: "https://pro.mufengapp.cn/components",
    tabListAriaLabel: "Categories",
    maxConcurrency: 5,
    
    // 配置链接收集定位符
    collectionNameLocator: "xpath=/div[2]/div[1]/div[1]",
    collectionCountLocator: "xpath=/div[2]/div[1]/div[2]",

    // 配置 Tab Section 的获取方式
    getTabSection: (page, tabText) => {
      return page
        .locator("section")
        .filter({ has: page.getByRole("heading", { name: tabText }) });
    },
  });

  // 使用 Block 模式，处理每个 Block
  await crawler
    .blocks("xpath=//main/div/div/div") // Block 定位符
    .each(async ({ block, blockPath, blockName, outputDir, currentPage }) => {
      console.log(`\n🔍 正在处理 block: ${blockName}`);

      // 点击切换到 Code
      await clickCodeTab(block);

      // 获取 ts 部分代码
      await saveAllLanguageFiles(
        block,
        blockPath,
        "ts",
        outputDir,
      );

      // 切换到 JavaScript
      await block
        .getByRole("button", { name: "TypeScript Change theme" })
        .click();
      // 这里不能用 block 去找，必须用 page，因为它被传送到了 body 下❗
      await currentPage.getByRole("option", { name: "JavaScript" }).click();

      // 切换后，得延迟一会儿，不然 fileTabs 还是之前的
      await currentPage.waitForTimeout(500);

      // 获取 js 部分代码
      await saveAllLanguageFiles(
        block,
        blockPath,
        "js",
        outputDir,
      );

      console.log(`✅ Block [${blockName}] 处理完成`);
    });
});

/**
 * 点击 Code Tab（至关重要，有时候没反应❗），如果超时再点击一次
 */
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

/**
 * 保存当前语言版本的所有文件代码到指定目录
 */
async function saveAllLanguageFiles(
  block: Locator,
  blockPath: string,
  language: "ts" | "js",
  outputDir: string,
) {
  // 获取所有文件 Tab
  const fileTabs = await block
    .getByRole("tablist", {
      name: "Select active file",
    })
    .getByRole("tab")
    .all();

  // 遍历所有文件 Tab
  for (let i = 0; i < fileTabs.length; i++) {
    const fileTab = fileTabs[i];

    if (i !== 0) {
      // 点击切换到文件 Tab
      await fileTab.click();
    }

    const fileName = await fileTab.textContent();
    // 使用封装的代码提取函数
    const code = await extractCodeFromBlock(block);

    // 输出到文件
    if (fileName) {
      await fse.outputFile(
        `${outputDir}/${blockPath}/${language}/${fileName}`,
        code
      );
      console.log(`   📝 已保存: ${language}/${fileName}`);
    } else {
      console.warn("⚠️ fileName is null");
      console.log(`blockPath: ${blockPath}, fileName: ${fileName}`);
    }
  }
}

