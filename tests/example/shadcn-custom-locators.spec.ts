import { test } from "@playwright/test";
import { BlockCrawler, type BlockContext } from "../../src";
import fse from "fs-extra";
import path from "path";

/**
 * 使用自定义定位符爬取 shadcndesign
 * 展示如何通过配置定位符来适配不同网站的 DOM 结构
 */

test("使用自定义定位符爬取 shadcndesign", async ({ page }) => {
  test.setTimeout(3 * 60 * 1000); // 3 分钟

  const crawler = new BlockCrawler({
    startUrl: "https://www.shadcndesign.com/pro-blocks",
    maxConcurrency: 3,
    blockLocator: "xpath=//main/div/div/div",
    
    // shadcndesign 的定位符配置
    collectionLinkLocator: "role=link", // 在 tabpanel 中查找链接
    collectionNameLocator: '[data-slot="card-title"]', // 通过 data-slot 找到标题
    collectionCountLocator: "p", // 通过 p 标签找到数量文本
  });

  await crawler.onBlock(page, async ({ block, blockPath, outputDir }: BlockContext) => {
    console.log(`处理 Block: ${blockPath}`);
    
    // 保存 block 信息
    await fse.outputFile(
      path.join(outputDir, blockPath, "info.json"),
      JSON.stringify(
        { 
          blockPath, 
          timestamp: new Date().toISOString() 
        }, 
        null, 
        2
      )
    );
  });
});

test("从配置文件加载 shadcndesign 配置", async ({ page }) => {
  test.setTimeout(3 * 60 * 1000); // 3 分钟

  // 从 shadcndesign 专用配置文件加载
  const crawler = await BlockCrawler.fromConfigFile(".crawler/config.shadcn.json");

  await crawler.onBlock(page, async ({ block, blockPath, outputDir }: BlockContext) => {
    console.log(`处理 Block: ${blockPath}`);
    
    // 保存 block 信息
    await fse.outputFile(
      path.join(outputDir, blockPath, "info.json"),
      JSON.stringify(
        { 
          blockPath, 
          timestamp: new Date().toISOString() 
        }, 
        null, 
        2
      )
    );
  });
});

