import type { Page } from "@playwright/test";
import pLimit from "p-limit";
import type { InternalConfig } from "./ConfigManager";
import type { TaskProgress } from "../utils/task-progress";
import { TabProcessor } from "./TabProcessor";
import { LinkCollector } from "./LinkCollector";
import { BlockProcessor } from "./BlockProcessor";
import { PageProcessor } from "./PageProcessor";
import { MetaCollector } from "./MetaCollector";

/**
 * 爬虫协调器
 * 职责：协调各个模块，执行完整的爬取流程
 */
export class CrawlerOrchestrator {
  private tabProcessor: TabProcessor;
  private linkCollector: LinkCollector;
  private metaCollector: MetaCollector;
  private limit: ReturnType<typeof pLimit>;

  constructor(
    private config: InternalConfig,
    private taskProgress?: TaskProgress
  ) {
    this.tabProcessor = new TabProcessor(config);
    this.linkCollector = new LinkCollector(config);
    this.metaCollector = new MetaCollector(config.startUrl, config.metaFile);
    this.limit = pLimit(config.maxConcurrency);
  }

  /**
   * 执行爬取流程
   */
  async run(
    page: Page,
    blockSectionLocator: string | null,
    blockHandler: ((context: any) => Promise<void>) | null,
    pageHandler: ((context: any) => Promise<void>) | null
  ): Promise<void> {
    console.log("\n🚀 ===== 开始执行爬虫任务 =====");
    console.log(`📍 目标URL: ${this.config.startUrl}`);
    console.log(`⚙️  最大并发数: ${this.config.maxConcurrency}`);
    console.log(`📂 输出目录: ${this.config.outputDir}`);
    console.log(
      `🎯 运行模式: ${blockSectionLocator ? "Block 处理模式" : "页面处理模式"}`
    );

    // 初始化任务进度
    if (this.taskProgress) {
      console.log("\n📊 初始化任务进度...");
      await this.taskProgress.initialize();
    }

    try {
      // 访问目标链接
      console.log("\n📡 正在访问目标链接...");
      await page.goto(this.config.startUrl, this.config.startUrlWaitOptions);
      console.log("✅ 页面加载完成");

      // 处理 Tabs 并收集链接
      await this.processTabsAndCollectLinks(page);

      // 并发处理所有链接
      await this.processAllLinks(page, blockSectionLocator, blockHandler, pageHandler);

      console.log("\n🎉 ===== 所有任务已完成 ===== \n");
    } catch (error) {
      console.error("\n❌ 处理过程中发生错误");
      throw error;
    } finally {
      // 保存进度
      if (this.taskProgress) {
        await this.taskProgress.saveProgress();
        console.log(
          `\n💾 进度已保存 (已完成 Block: ${this.taskProgress.getCompletedBlockCount()}, 已完成 Page: ${this.taskProgress.getCompletedPageCount()})`
        );
      }
      
      // 保存元信息
      await this.metaCollector.save();
    }
  }

  /**
   * 处理所有 Tabs 并收集链接
   */
  private async processTabsAndCollectLinks(page: Page): Promise<void> {
    // 优先级 1：如果配置了 getAllTabSections，使用新模式（跳过 tab 点击）
    const tabSections = await this.tabProcessor.getAllTabSections(page);
    
    if (tabSections) {
      console.log("\n📑 正在获取所有 Tab Sections（跳过 tab 点击）...");
      console.log(`✅ 找到 ${tabSections.length} 个 Tab Section`);

      console.log("\n🔄 开始遍历所有 Tab Sections...");
      for (let i = 0; i < tabSections.length; i++) {
        const section = tabSections[i];
        console.log(`\n📌 [${i + 1}/${tabSections.length}] 处理 Tab Section ${i + 1}...`);
        
        // 从 section 中提取 tabText
        const tabText = await this.tabProcessor.extractTabText(section, i);
        console.log(`   🏷️  Tab 文本: ${tabText}`);
        
        // 收集链接
        await this.linkCollector.collectLinks(section);
        console.log(`   ✅ Tab Section [${tabText}] 处理完成`);
      }
    } else {
      // 优先级 2：原有逻辑 - 获取 tab 元素并点击
      console.log("\n📑 正在获取所有分类标签...");
      const tabs = await this.tabProcessor.getAllTabs(page);
      console.log(`✅ 找到 ${tabs.length} 个分类标签`);

      console.log("\n🔄 开始遍历所有分类标签...");
      for (let i = 0; i < tabs.length; i++) {
        const tab = tabs[i];
        console.log(`\n📌 [${i + 1}/${tabs.length}] 处理分类标签...`);
        await this.tabProcessor.clickTab(tab, i);
        const tabText = (await tab.textContent()) ?? "";
        await this.handleSingleTab(page, tabText);
      }
    }

    console.log(`\n✨ 收集完成！总共 ${this.linkCollector.getTotalBlockCount()} 个 blocks`);
    console.log(`📊 总共 ${this.linkCollector.getAllLinks().length} 个集合链接待处理\n`);
    
    // 将收集到的链接添加到元信息收集器
    this.metaCollector.addCollectionLinks(this.linkCollector.getAllLinks());
  }

  /**
   * 处理单个 Tab
   */
  private async handleSingleTab(page: Page, tabText: string): Promise<void> {
    console.log(`   🔍 正在处理分类: ${tabText}`);

    const section = this.tabProcessor.getTabSection(page, tabText);
    await this.linkCollector.collectLinks(section);
    
    console.log(`   ✅ 分类 [${tabText}] 处理完成`);
  }

  /**
   * 并发处理所有链接
   */
  private async processAllLinks(
    page: Page,
    blockSectionLocator: string | null,
    blockHandler: ((context: any) => Promise<void>) | null,
    pageHandler: ((context: any) => Promise<void>) | null
  ): Promise<void> {
    const allLinks = this.linkCollector.getAllLinks();
    const total = allLinks.length;
    let completed = 0;
    let failed = 0;

    console.log(`\n🚀 开始并发处理所有链接 (最大并发: ${this.config.maxConcurrency})...`);
    console.log(`\n📦 开始处理 ${total} 个集合链接...`);

    await Promise.allSettled(
      allLinks.map((linkObj, index) =>
        this.limit(async () => {
          // 跳过已完成的页面
          const normalizedPath = linkObj.link.startsWith("/")
            ? linkObj.link.slice(1)
            : linkObj.link;

          if (this.taskProgress?.isPageComplete(normalizedPath)) {
            console.log(`⏭️  跳过已完成的页面: ${linkObj.name || normalizedPath}`);
            completed++;
            return;
          }

          try {
            await this.handleSingleLink(
              page,
              linkObj.link,
              index === 0,
              blockSectionLocator,
              blockHandler,
              pageHandler
            );
            completed++;
            console.log(`✅ [${completed + failed}/${total}] 完成: ${linkObj.name || linkObj.link}\n`);
          } catch (error) {
            failed++;
            console.error(`❌ [${completed + failed}/${total}] 失败: ${linkObj.name || linkObj.link}\n`, error);
          }
        })
      )
    );

    console.log(`\n📊 处理完成统计:`);
    console.log(`   ✅ 成功: ${completed}/${total}`);
    console.log(`   ❌ 失败: ${failed}/${total}`);
  }

  /**
   * 处理单个链接
   */
  private async handleSingleLink(
    page: Page,
    relativeLink: string,
    isFirst: boolean,
    blockSectionLocator: string | null,
    blockHandler: ((context: any) => Promise<void>) | null,
    pageHandler: ((context: any) => Promise<void>) | null
  ): Promise<void> {
    const domain = new URL(this.config.startUrl).hostname;
    const url = `https://${domain}${relativeLink}`;

    const newPage = isFirst ? page : await page.context().newPage();

    try {
      await newPage.goto(url, this.config.collectionLinkWaitOptions);

      // 根据模式决定处理方式
      if (blockSectionLocator && blockHandler) {
        const blockProcessor = new BlockProcessor(
          this.config,
          blockSectionLocator,
          blockHandler,
          this.taskProgress
        );
        const result = await blockProcessor.processBlocksInPage(newPage, relativeLink);
        
        // 记录实际组件数和 free blocks
        this.metaCollector.incrementActualCount(result.totalCount);
        result.freeBlocks.forEach(blockName => {
          this.metaCollector.addFreeBlock(blockName);
        });
      } else if (pageHandler) {
        const pageProcessor = new PageProcessor(this.config, pageHandler);
        const result = await pageProcessor.processPage(newPage, relativeLink);
        
        // 记录 free pages
        if (result.isFree) {
          this.metaCollector.addFreePage(relativeLink);
        }
      }
    } finally {
      if (!isFirst) {
        console.log(`\n🔍 关闭页面: ${relativeLink}`);
        await newPage.close();
      }
    }
  }
}

