import type { Page, Locator } from "@playwright/test";
import pLimit from "p-limit";
import type { InternalConfig } from "./ConfigManager";
import type { TaskProgress } from "../utils/task-progress";
import { TabProcessor } from "./TabProcessor";
import { LinkCollector } from "./LinkCollector";
import { BlockProcessor } from "./BlockProcessor";
import { PageProcessor } from "./PageProcessor";
import { MetaCollector } from "./MetaCollector";
import { ScriptInjector } from "./ScriptInjector";
import { BlockNameExtractor } from "./BlockNameExtractor";
import { createI18n, type I18n } from "../utils/i18n";

/**
 * 爬虫协调器
 * 职责：协调各个模块，执行完整的爬取流程
 */
export class CrawlerOrchestrator {
  private tabProcessor: TabProcessor;
  private linkCollector: LinkCollector;
  private metaCollector: MetaCollector;
  private scriptInjector: ScriptInjector;
  private blockNameExtractor: BlockNameExtractor;
  private limit: ReturnType<typeof pLimit>;
  private i18n: I18n;

  constructor(
    private config: InternalConfig,
    private taskProgress?: TaskProgress
  ) {
    this.tabProcessor = new TabProcessor(config);
    this.linkCollector = new LinkCollector(config);
    this.metaCollector = new MetaCollector(config.startUrl, config.metaFile, config.locale);
    this.scriptInjector = new ScriptInjector(config);
    this.blockNameExtractor = new BlockNameExtractor(config);
    this.limit = pLimit(config.maxConcurrency);
    this.i18n = createI18n(config.locale);
  }

  /**
   * 执行爬取流程
   */
  async run(
    page: Page,
    blockSectionLocator: string | null,
    blockHandler: ((context: any) => Promise<void>) | null,
    pageHandler: ((context: any) => Promise<void>) | null,
    beforeProcessBlocks: ((page: Page) => Promise<void>) | null,
    testMode: {
      url: string;
      sectionLocator: string;
      blockName?: string;
      handler: ((context: any) => Promise<void>);
      beforeHandler?: ((page: Page) => Promise<void>);
    } | null = null
  ): Promise<void> {
    console.log(`\n${this.i18n.t('crawler.taskStart')}`);
    
    // 测试模式：跳过链接收集，直接测试单个组件
    if (testMode) {
      console.log(this.i18n.t('crawler.modeTest'));
      console.log(this.i18n.t('crawler.testUrl', { url: testMode.url }));
      console.log(this.i18n.t('crawler.testSectionLocator', { locator: testMode.sectionLocator }));
      if (testMode.blockName) {
        console.log(this.i18n.t('crawler.testBlockName', { name: testMode.blockName }));
      }
      console.log(this.i18n.t('crawler.outputDir', { dir: this.config.outputDir }));
      
      await this.runTestMode(page, testMode);
      return;
    }
    
    console.log(this.i18n.t('crawler.targetUrl', { url: this.config.startUrl }));
    console.log(this.i18n.t('crawler.maxConcurrency', { count: this.config.maxConcurrency }));
    console.log(this.i18n.t('crawler.outputDir', { dir: this.config.outputDir }));
    const mode = blockSectionLocator 
      ? this.i18n.t('crawler.modeBlock')
      : this.i18n.t('crawler.modePage');
    console.log(this.i18n.t('crawler.mode', { mode }));

    // 初始化任务进度
    if (this.taskProgress) {
      console.log(`\n${this.i18n.t('crawler.initProgress')}`);
      await this.taskProgress.initialize();
    }

    // 初始化元信息收集器（加载已有数据）
    await this.metaCollector.initialize();

    let isComplete = false;
    try {
      // 访问目标链接
      console.log(`\n${this.i18n.t('crawler.visiting')}`);
      await page.goto(this.config.startUrl, this.config.startUrlWaitOptions);
      console.log(this.i18n.t('crawler.pageLoaded'));

      // 处理 Tabs 并收集链接
      await this.processTabsAndCollectLinks(page);

      // 并发处理所有链接
      await this.processAllLinks(page, blockSectionLocator, blockHandler, pageHandler, beforeProcessBlocks);

      console.log(`\n${this.i18n.t('crawler.allComplete')}\n`);
      isComplete = true; // 正常完成，标记为完整
    } catch (error) {
      console.error(`\n${this.i18n.t('common.error')}`);
      isComplete = false; // 发生错误，标记为未完整
      throw error;
    } finally {
      await this.cleanup(isComplete);
    }
  }

  /**
   * 清理资源（保存进度和元信息）
   * 在正常结束或中断时调用
   */
  async cleanup(isComplete: boolean = false): Promise<void> {
    // 保存进度
    if (this.taskProgress) {
      await this.taskProgress.saveProgress();
      console.log(
        `\n${this.i18n.t('progress.saved', { blocks: this.taskProgress.getCompletedBlockCount(), pages: this.taskProgress.getCompletedPageCount() })}`
      );
    }
    
    // 保存元信息
    await this.metaCollector.save(isComplete);
  }

  /**
   * 处理所有 Tabs 并收集链接
   */
  private async processTabsAndCollectLinks(page: Page): Promise<void> {
    // 优先级 1：如果配置了 getAllTabSections，使用新模式（跳过 tab 点击）
    const tabSections = await this.tabProcessor.getAllTabSections(page);
    
    if (tabSections) {
      console.log(`\n${this.i18n.t('tab.gettingSections')}`);
      console.log(this.i18n.t('tab.foundSections', { count: tabSections.length }));

      console.log(`\n${this.i18n.t('tab.processingSections')}`);
      for (let i = 0; i < tabSections.length; i++) {
        const section = tabSections[i];
        console.log(`\n${this.i18n.t('tab.processingSection', { current: i + 1, total: tabSections.length, index: i + 1 })}`);
        
        // 提取 tab 文本（内部包含日志输出）
        await this.tabProcessor.extractTabText(section, i);
        
        // 收集链接
        await this.linkCollector.collectLinks(section);
      }
    } else {
      // 优先级 2：原有逻辑 - 获取 tab 元素并点击
      console.log(`\n${this.i18n.t('tab.getting')}`);
      const tabs = await this.tabProcessor.getAllTabs(page);
      console.log(this.i18n.t('tab.found', { count: tabs.length }));

      console.log(`\n${this.i18n.t('tab.processing')}`);
      for (let i = 0; i < tabs.length; i++) {
        const tab = tabs[i];
        await this.tabProcessor.clickTab(tab, i);
        const tabText = (await tab.textContent()) ?? "";
        await this.handleSingleTab(page, tabText);
      }
    }

    const allLinks = this.linkCollector.getAllLinks();
    const totalBlocks = this.linkCollector.getTotalBlockCount();
    
    console.log(`\n${this.i18n.t('link.complete')}`);
    console.log(`   ${this.i18n.t('link.totalLinks', { count: allLinks.length })}`);
    
    // 只有配置了 collectionCountLocator 时才输出总组件数
    if (this.config.collectionCountLocator) {
      console.log(`   ${this.i18n.t('link.totalBlocks', { count: totalBlocks })}`);
    }
    console.log();
    
    // 将收集到的链接添加到元信息收集器
    this.metaCollector.addCollectionLinks(allLinks);
  }

  /**
   * 处理单个 Tab
   */
  private async handleSingleTab(page: Page, tabText: string): Promise<void> {
    console.log(`   ${this.i18n.t('crawler.processingCategory', { category: tabText })}`);

    const section = this.tabProcessor.getTabSection(page, tabText);
    await this.linkCollector.collectLinks(section);
    
    console.log(`   ${this.i18n.t('crawler.categoryComplete', { category: tabText })}`);
  }

  /**
   * 并发处理所有链接
   */
  private async processAllLinks(
    page: Page,
    blockSectionLocator: string | null,
    blockHandler: ((context: any) => Promise<void>) | null,
    pageHandler: ((context: any) => Promise<void>) | null,
    beforeProcessBlocks: ((page: Page) => Promise<void>) | null
  ): Promise<void> {
    const allLinks = this.linkCollector.getAllLinks();
    const total = allLinks.length;
    let completed = 0;
    let failed = 0;

    // 如果 skipFree 开启，从 meta.json 中加载已知的 Free 页面
    let knownFreePages: Set<string> = new Set();
    if (this.config.skipFree) {
      const freePagesList = await MetaCollector.loadFreePages(this.config.metaFile);
      if (freePagesList.length > 0) {
        knownFreePages = new Set(freePagesList);
        console.log(this.i18n.t('crawler.loadedFreePages', { count: knownFreePages.size }));
      }
    }

    console.log(`\n${this.i18n.t('crawler.startConcurrent', { concurrency: this.config.maxConcurrency })}`);
    console.log(`\n${this.i18n.t('crawler.startProcessing', { total })}`);

    await Promise.allSettled(
      allLinks.map((linkObj, index) =>
        this.limit(async () => {
          // 跳过已完成的页面
          const normalizedPath = linkObj.link.startsWith("/")
            ? linkObj.link.slice(1)
            : linkObj.link;

          if (this.taskProgress?.isPageComplete(normalizedPath)) {
            console.log(this.i18n.t('crawler.skipCompleted', { name: linkObj.name || normalizedPath }));
            completed++;
            return;
          }

          // 跳过已知的 Free 页面（从 meta.json 中加载）
          if (knownFreePages.has(linkObj.link)) {
            console.log(this.i18n.t('crawler.skipKnownFree', { name: linkObj.name || linkObj.link }));
            this.metaCollector.addFreePage(linkObj.link); // 重新记录到新的 meta.json
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
              pageHandler,
              beforeProcessBlocks
            );
            completed++;
            const progress = `${completed + failed}/${total}`;
            console.log(`${this.i18n.t('crawler.linkComplete', { progress, name: linkObj.name || linkObj.link })}\n`);
          } catch (error) {
            failed++;
            const progress = `${completed + failed}/${total}`;
            console.error(`${this.i18n.t('crawler.linkFailed', { progress, name: linkObj.name || linkObj.link })}\n`, error);
          }
        })
      )
    );

    console.log(`\n${this.i18n.t('crawler.statistics')}`);
    console.log(`   ${this.i18n.t('crawler.success', { count: completed, total })}`);
    console.log(`   ${this.i18n.t('crawler.failed', { count: failed, total })}`);
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
    pageHandler: ((context: any) => Promise<void>) | null,
    beforeProcessBlocks: ((page: Page) => Promise<void>) | null
  ): Promise<void> {
    const domain = new URL(this.config.startUrl).hostname;
    const url = `https://${domain}${relativeLink}`;

    const newPage = isFirst ? page : await page.context().newPage();

    try {
      // 注入脚本（仅对非首页的新页面注入，且在页面加载前注入）
      if (!isFirst && this.scriptInjector.isEnabled()) {
        await this.scriptInjector.inject(newPage, true);
      }

      await newPage.goto(url, this.config.collectionLinkWaitOptions);

      // 先检查页面是否为 Free（公共逻辑，提前快速跳过）
      const isPageFree = await PageProcessor.checkPageFree(newPage, this.config);
      if (isPageFree) {
        console.log(this.i18n.t('page.skipFree', { path: relativeLink }));
        this.metaCollector.addFreePage(relativeLink);
        // 标记页面为完成
        this.taskProgress?.markPageComplete(this.normalizePagePath(relativeLink));
        return; // 直接返回，不注入脚本，不执行处理逻辑
      }

      // 注入脚本（仅对非首页的新页面注入，且在页面加载后注入）
      if (!isFirst && this.scriptInjector.isEnabled()) {
        await this.scriptInjector.inject(newPage, false);
      }

      // 根据模式决定处理方式
      if (blockSectionLocator && blockHandler) {
        const blockProcessor = new BlockProcessor(
          this.config,
          blockSectionLocator,
          blockHandler,
          this.taskProgress,
          beforeProcessBlocks
        );
        const result = await blockProcessor.processBlocksInPage(newPage, relativeLink);
        
        // 记录实际组件数和 free blocks
        this.metaCollector.incrementActualCount(result.totalCount);
        result.freeBlocks.forEach(blockName => {
          this.metaCollector.addFreeBlock(blockName);
        });
      } else if (pageHandler) {
        const pageProcessor = new PageProcessor(this.config, pageHandler);
        await pageProcessor.processPage(newPage, relativeLink);
        
        // 标记页面为完成
        this.taskProgress?.markPageComplete(this.normalizePagePath(relativeLink));
      }
    } finally {
      if (!isFirst) {
        console.log(`\n${this.i18n.t('crawler.closePage', { path: relativeLink })}`);
        await newPage.close();
      }
    }
  }

  /**
   * 标准化页面路径
   */
  private normalizePagePath(link: string): string {
    return link.startsWith("/") ? link.slice(1) : link;
  }

  /**
   * 运行测试模式
   */
  private async runTestMode(
    page: Page,
    testMode: {
      url: string;
      sectionLocator: string;
      blockName?: string;
      sectionIndex?: number;
      handler: ((context: any) => Promise<void>);
      beforeHandler?: ((page: Page) => Promise<void>);
    }
  ): Promise<void> {
    try {
      console.log(`\n${this.i18n.t('crawler.testVisiting')}`);
      
      // 应用脚本注入（在页面加载前）
      if (this.scriptInjector.isEnabled()) {
        await this.scriptInjector.inject(page, true);
      }
      
      // 访问目标页面，应用 collectionLinkWaitOptions
      await page.goto(testMode.url, this.config.collectionLinkWaitOptions);
      console.log(this.i18n.t('crawler.pageLoaded'));
      
      // 应用脚本注入（在页面加载后）
      if (this.scriptInjector.isEnabled()) {
        await this.scriptInjector.inject(page, false);
      }
      
      // 执行前置逻辑
      if (testMode.beforeHandler) {
        console.log(`\n${this.i18n.t('crawler.testBeforeHandler')}`);
        await testMode.beforeHandler(page);
      }
      
      // 获取所有匹配的 sections
      console.log(`\n${this.i18n.t('crawler.testGettingSection')}`);
      const sections = await page.locator(testMode.sectionLocator).all();
      console.log(this.i18n.t('crawler.testFoundSections', { count: sections.length }));
      
      if (sections.length === 0) {
        throw new Error(`❌ 未找到匹配的 section: ${testMode.sectionLocator}`);
      }
      
      // 确定目标 section
      // 优先级：sectionIndex > blockName > 第一个
      let targetSection;
      let blockName = "";
      
      if (testMode.sectionIndex !== undefined) {
        // 优先级 1：使用 sectionIndex
        if (testMode.sectionIndex < 0 || testMode.sectionIndex >= sections.length) {
          throw new Error(
            `❌ sectionIndex ${testMode.sectionIndex} 超出范围（共 ${sections.length} 个 section，索引范围：0-${sections.length - 1}）`
          );
        }
        targetSection = sections[testMode.sectionIndex];
        blockName = await this.extractBlockName(targetSection);
        console.log(
          `\n${this.i18n.t('crawler.testUsingIndex', { index: testMode.sectionIndex, name: blockName })}`
        );
      } else if (testMode.blockName) {
        // 优先级 2：使用 blockName，逐个比对
        console.log(`\n${this.i18n.t('crawler.testFindingByName', { name: testMode.blockName })}`);
        
        for (const section of sections) {
          const name = await this.extractBlockName(section);
          if (name && name.trim() === testMode.blockName.trim()) {
            targetSection = section;
            blockName = name;
            break;
          }
        }
        
        if (!targetSection) {
          throw new Error(`❌ 未找到名为 "${testMode.blockName}" 的组件`);
        }
      } else {
        // 优先级 3：使用第一个 section
        targetSection = sections[0];
        blockName = await this.extractBlockName(targetSection);
        console.log(`\n${this.i18n.t('crawler.testUsingFirst', { name: blockName })}`);
      }
      
      // 执行测试逻辑
      console.log(`\n${this.i18n.t('crawler.testRunning')}`);
      await testMode.handler({
        currentPage: page,
        section: targetSection,
        blockName,
        outputDir: this.config.outputDir,
      });
      
      console.log(`\n${this.i18n.t('crawler.testComplete')}`);
    } catch (error) {
      console.error(`\n${this.i18n.t('crawler.testFailed')}`);
      throw error;
    }
  }

  /**
   * 提取 block 名称（用于测试模式）
   * 使用 BlockNameExtractor 统一处理
   */
  private async extractBlockName(section: Locator): Promise<string> {
    const name = await this.blockNameExtractor.extract(section);
    return name?.trim() || "Unknown";
  }
}

