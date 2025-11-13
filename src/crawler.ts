import type { Page } from "@playwright/test";
import { TaskProgress } from "./utils/task-progress";
import type {
  CrawlerConfig,
  PageHandler,
  BlockHandler,
  BeforeProcessBlocksHandler,
} from "./types";
import { ConfigManager, type InternalConfig } from "./core/ConfigManager";
import { CrawlerOrchestrator } from "./core/CrawlerOrchestrator";
import { createI18n, type I18n } from "./utils/i18n";

/**
 * Block Chain - 用于链式调用 Block 处理模式
 */
class BlockChain {
  private beforeHandler?: BeforeProcessBlocksHandler;

  constructor(
    private crawler: BlockCrawler,
    private sectionLocator: string
  ) {}

  /**
   * 设置前置处理函数（在匹配所有 Block 之前执行）
   * 
   * @param handler 前置处理函数
   * @returns this 支持链式调用
   * 
   * @example
   * .before(async (currentPage) => {
   *   await currentPage.getByRole('tab', { name: 'List view' }).click();
   * })
   */
  before(handler: BeforeProcessBlocksHandler): this {
    this.beforeHandler = handler;
    return this;
  }

  /**
   * 执行 Block 处理逻辑
   * 
   * @param handler Block 处理函数
   * 
   * @example
   * .each(async ({ block, blockName, currentPage }) => {
   *   console.log(`处理 Block: ${blockName}`);
   * })
   */
  async each(handler: BlockHandler): Promise<void> {
    await this.crawler.runBlockMode(
      this.sectionLocator,
      handler,
      this.beforeHandler
    );
  }
}

/**
 * Page Chain - 用于链式调用 Page 处理模式
 */
class PageChain {
  constructor(private crawler: BlockCrawler) {}

  /**
   * 执行 Page 处理逻辑
   * 
   * @param handler Page 处理函数
   * 
   * @example
   * .each(async ({ currentPage, currentPath }) => {
   *   const title = await currentPage.title();
   * })
   */
  async each(handler: PageHandler): Promise<void> {
    await this.crawler.runPageMode(handler);
  }
}

/**
 * Block 爬虫核心类
 * 
 * 支持两种模式：
 * 1. Block 处理模式（使用 blocks()）
 * 2. Page 处理模式（使用 pages()）
 * 
 * @example
 * // Block 模式
 * const crawler = new BlockCrawler(page, { startUrl: "...", ... });
 * await crawler
 *   .blocks('[data-preview]')
 *   .before(async (currentPage) => { ... })
 *   .each(async ({ block, blockName }) => { ... });
 * 
 * @example
 * // Page 模式
 * const crawler = new BlockCrawler(page, { startUrl: "...", ... });
 * await crawler
 *   .pages()
 *   .each(async ({ currentPage, currentPath }) => { ... });
 */
export class BlockCrawler {
  private config: InternalConfig;
  private taskProgress?: TaskProgress;
  private orchestrator?: CrawlerOrchestrator;
  private signalHandler?: NodeJS.SignalsListener;
  private i18n: I18n;

  constructor(
    private page: Page,
    config: CrawlerConfig
  ) {
    // 创建内部配置
    this.config = ConfigManager.createInternalConfig(config);
    this.i18n = createI18n(this.config.locale);

    // 初始化进度管理器
    if (this.config.enableProgressResume) {
      this.taskProgress = new TaskProgress(
        this.config.progressFile,
        this.config.outputDir,
        this.config.locale
      );
    }
  }

  /**
   * Block 处理模式
   * 
   * @param sectionLocator Block 区域定位符
   * @returns BlockChain 支持链式调用
   * 
   * @example
   * await crawler
   *   .blocks('[data-preview]')
   *   .before(async (currentPage) => {
   *     await currentPage.getByRole('tab', { name: 'List view' }).click();
   *   })
   *   .each(async ({ block, blockName }) => {
   *     console.log(`处理 Block: ${blockName}`);
   *   });
   */
  blocks(sectionLocator: string): BlockChain {
    return new BlockChain(this, sectionLocator);
  }

  /**
   * Page 处理模式
   * 
   * @returns PageChain 支持链式调用
   * 
   * @example
   * await crawler
   *   .pages()
   *   .each(async ({ currentPage, currentPath }) => {
   *     const title = await currentPage.title();
   *   });
   */
  pages(): PageChain {
    return new PageChain(this);
  }

  /**
   * 运行 Block 模式（内部方法）
   */
  async runBlockMode(
    sectionLocator: string,
    handler: BlockHandler,
    beforeHandler?: BeforeProcessBlocksHandler
  ): Promise<void> {
    await this.run(sectionLocator, handler, null, beforeHandler);
  }

  /**
   * 运行 Page 模式（内部方法）
   */
  async runPageMode(handler: PageHandler): Promise<void> {
    await this.run(null, null, handler, undefined);
  }

  /**
   * 运行爬虫（内部方法）
   */
  private async run(
    blockSectionLocator: string | null,
    blockHandler: BlockHandler | null,
    pageHandler: PageHandler | null,
    beforeProcessBlocks: BeforeProcessBlocksHandler | undefined
  ): Promise<void> {
    this.orchestrator = new CrawlerOrchestrator(this.config, this.taskProgress);
    
    // 设置 Ctrl+C 信号处理器
    this.setupSignalHandlers();
    
    try {
      await this.orchestrator.run(
        this.page,
        blockSectionLocator,
        blockHandler,
        pageHandler,
        beforeProcessBlocks || null
      );
    } finally {
      // 清理信号处理器
      this.removeSignalHandlers();
    }
  }

  /**
   * 设置信号处理器（Ctrl+C）
   */
  private setupSignalHandlers(): void {
    this.signalHandler = async (signal: NodeJS.Signals) => {
      console.log(`\n\n${this.i18n.t('signal.received', { signal })}\n`);
      
      if (this.orchestrator) {
        try {
          await this.orchestrator.cleanup();
          console.log(`\n${this.i18n.t('signal.saved')}\n`);
        } catch (error) {
          console.error(`\n${this.i18n.t('signal.saveFailed', { error: String(error) })}`);
        }
      }
      
      process.exit(0);
    };
    
    process.on("SIGINT", this.signalHandler);
    process.on("SIGTERM", this.signalHandler);
  }

  /**
   * 移除信号处理器
   */
  private removeSignalHandlers(): void {
    if (this.signalHandler) {
      process.off("SIGINT", this.signalHandler);
      process.off("SIGTERM", this.signalHandler);
    }
  }

  /**
   * 获取任务进度管理器
   */
  getTaskProgress(): TaskProgress | undefined {
    return this.taskProgress;
  }

  /**
   * 获取配置（只读）
   */
  getConfig(): Readonly<InternalConfig> {
    return this.config;
  }

  /**
   * 获取输出目录
   */
  get outputDir(): string {
    return this.config.outputDir;
  }

  /**
   * 获取状态目录
   */
  get stateDir(): string {
    return this.config.stateDir;
  }

  /**
   * 获取进度文件路径
   */
  get progressFile(): string {
    return this.config.progressFile;
  }

  /**
   * 获取域名（用于子目录划分）
   */
  get hostname(): string {
    return this.config.hostname;
  }
}
