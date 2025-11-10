import { test, type Locator } from "@playwright/test";
import fse from "fs-extra";
import { BlockCrawler, type BlockContext } from "../src";
import { extractCodeFromBlock } from "../src/utils/extract-code";

/**
 * 使用配置文件的示例
 * 展示如何从配置文件加载爬虫配置
 */

test("从配置文件加载配置", async ({ page }) => {
  // 设置超时
  test.setTimeout(2 * 60 * 1000);

  // 方式1: 从默认配置文件加载 (.crawler/config.json)
  // const crawler = await BlockCrawler.fromConfigFile();

  // 方式2: 从指定配置文件加载
  // const crawler = await BlockCrawler.fromConfigFile(".crawler/my-config.json");

  // 方式3: 先创建实例，然后保存配置以供后续使用
  const crawler = new BlockCrawler({
    startUrl: "https://pro.mufengapp.cn/components",
    tabListAriaLabel: "Categories",
    maxConcurrency: 5,
    blockLocator: "xpath=//main/div/div/div",
  });

  // 保存配置到文件
  await crawler.saveConfigFile(".crawler/config.json");

  // 设置 Block 处理器
  crawler.onBlock(
    async ({ block, page, blockPath, outputDir }: BlockContext) => {
      // 点击切换到 Code
      await clickCodeTab(block);

      // 获取 ts 部分代码
      await saveAllLanguageFiles(block, blockPath, outputDir, "ts");

      // 切换 js
      await block
        .getByRole("button", { name: "TypeScript Change theme" })
        .click();
      await page.getByRole("option", { name: "JavaScript" }).click();

      // 切换后，得延迟一会儿
      await page.waitForTimeout(500);

      // 获取 js 部分代码
      await saveAllLanguageFiles(block, blockPath, outputDir, "js");
    }
  );

  // 运行爬虫
  await crawler.run(page);
});

// ========== 辅助函数 ==========

async function clickCodeTab(block: Locator) {
  const codeTab = block.getByRole("tab", { name: "Code" });
  await codeTab.click();
  try {
    await block
      .getByText("App.tsx")
      .waitFor({ state: "visible", timeout: 1500 });
  } catch (e) {
    console.warn("⚠️ Code tab first click timeout, retrying...");
    await codeTab.click();
    await block
      .getByText("App.tsx")
      .waitFor({ state: "visible", timeout: 3000 });
  }
}

async function saveAllLanguageFiles(
  block: Locator,
  blockPath: string,
  outputDir: string,
  language: "ts" | "js"
) {
  const fileTabs = await block
    .getByRole("tablist", {
      name: "Select active file",
    })
    .getByRole("tab")
    .all();

  for (let i = 0; i < fileTabs.length; i++) {
    const fileTab = fileTabs[i];

    if (i != 0) {
      await fileTab.click();
    }

    const fileName = await fileTab.textContent();
    const code = await extractCodeFromBlock(block);

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

