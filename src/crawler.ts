import type { Page } from "@playwright/test";
import { TaskProgress } from "./utils/task-progress";
import type {
  CrawlerConfig,
  PageHandler,
  BlockHandler,
  BeforeProcessBlocksHandler,
  TestHandler,
} from "./types";
import { ConfigManager, type InternalConfig } from "./core/ConfigManager";
import { CrawlerOrchestrator } from "./core/CrawlerOrchestrator";
import { createI18n, type I18n } from "./utils/i18n";

/**
 * Block 模式配置选项
 */
export interface BlockModeOptions {
  /**
   * 验证 Block 采集完整性
   * 
   * 当开启时，在关闭页面前会验证：
   * 1. 记录 sectionLocator 定位到的 block 总数（预期数量）
   * 2. 记录实际采集的 block 数量
   * 3. 如果两者不一致，调用 page.pause() 暂停，方便检查问题
   * 
   * @default true
   */
  verifyBlockCompletion?: boolean;
}

/**
 * Block Chain - 用于链式调用 Block 处理模式
 */
class BlockChain {
  private beforeHandler?: BeforeProcessBlocksHandler;

  constructor(
    private crawler: BlockCrawler,
    private sectionLocator: string,
    private options: BlockModeOptions
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
      this.beforeHandler,
      this.options
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
 * Test Chain - 用于链式调用测试模式
 */
class TestChain {
  private beforeHandler?: BeforeProcessBlocksHandler;

  constructor(
    private crawler: BlockCrawler,
    private url: string,
    private sectionLocator: string,
    private sectionIndex?: number,
    private blockName?: string
  ) {}

  /**
   * 设置前置处理函数（在页面加载之后、获取 section 之前执行）
   * 
   * @param handler 前置处理函数
   * @returns this 支持链式调用
   * 
   * @example
   * .before(async (currentPage) => {
   *   await currentPage.getByRole('tab', { name: 'Code' }).click();
   * })
   */
  before(handler: BeforeProcessBlocksHandler): this {
    this.beforeHandler = handler;
    return this;
  }

  /**
   * 执行测试逻辑
   * 
   * @param handler 测试处理函数
   * 
   * @example
   * .run(async ({ section, blockName, currentPage }) => {
   *   const code = await section.locator('pre').textContent();
   *   console.log('提取的代码:', code);
   * })
   */
  async run(handler: TestHandler): Promise<void> {
    await this.crawler.runTestMode(
      this.url,
      this.sectionLocator,
      this.sectionIndex,
      this.blockName,
      handler,
      this.beforeHandler
    );
  }
}

/**
 * Block 爬虫核心类
 * 
 * 支持三种模式：
 * 1. Block 处理模式（使用 blocks()）
 * 2. Page 处理模式（使用 pages()）
 * 3. 测试模式（使用 test()）
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
 * 
 * @example
 * // 测试模式
 * const crawler = new BlockCrawler(page, { startUrl: "...", ... });
 * await crawler
 *   .test("https://example.com/page", "[data-preview]")
 *   .before(async (currentPage) => { ... })
 *   .run(async ({ section, blockName }) => { ... });
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
    this.taskProgress = new TaskProgress(
      this.config.progressFile,
      this.config.outputDir,
      this.config.stateDir,
      this.config.locale,
      this.config.progress
    );
  }

  /**
   * Block 处理模式
   * 
   * @param sectionLocator Block 区域定位符
   * @param options Block 模式配置选项
   * @returns BlockChain 支持链式调用
   * 
   * @example
   * await crawler
   *   .blocks('[data-preview]', { verifyBlockCompletion: false })  // 生产环境关闭验证
   *   .before(async (currentPage) => {
   *     await currentPage.getByRole('tab', { name: 'List view' }).click();
   *   })
   *   .each(async ({ block, blockName }) => {
   *     console.log(`处理 Block: ${blockName}`);
   *   });
   */
  blocks(sectionLocator: string, options: BlockModeOptions = {}): BlockChain {
    return new BlockChain(this, sectionLocator, options);
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
   * 测试模式
   * 用于快速测试单个组件的提取逻辑
   * 
   * @param url 目标页面 URL
   * @param sectionLocator 整个页面所有 blockSection 的定位符（用于匹配所有 section）
   * @param sectionIndex 可选的 section 索引（nth 值，从 0 开始，优先级高于 blockName，性能更好）
   * @param blockName 可选的 Block 名称（会逐个 section 比对 blockName，找到匹配的）
   * @returns TestChain 支持链式调用
   * 
   * @example
   * // 使用第一个匹配的 section（默认）
   * await crawler
   *   .test("https://example.com/page", "[data-preview]")
   *   .before(async (currentPage) => {
   *     await currentPage.getByRole('tab', { name: 'Code' }).click();
   *   })
   *   .run(async ({ section, blockName, currentPage }) => {
   *     const code = await section.locator('pre').textContent();
   *     console.log('提取的代码:', code);
   *   });
   * 
   * @example
   * // 使用 sectionIndex 指定第几个 section（索引从 0 开始，性能更好）
   * await crawler
   *   .test("https://example.com/page", "[data-preview]", 1)
   *   .run(async ({ section, blockName }) => {
   *     // 处理第 2 个 section（索引 1）
   *   });
   * 
   * @example
   * // 使用 blockName 查找（会逐个比对）
   * await crawler
   *   .test("https://example.com/page", "[data-preview]", undefined, "Button")
   *   .run(async ({ section }) => {
   *     // 处理名为 "Button" 的组件
   *   });
   */
  test(url: string, sectionLocator: string, sectionIndex?: number, blockName?: string): TestChain {
    return new TestChain(this, url, sectionLocator, sectionIndex, blockName);
  }

  /**
   * 运行 Block 模式（内部方法）
   */
  async runBlockMode(
    sectionLocator: string,
    handler: BlockHandler,
    beforeHandler?: BeforeProcessBlocksHandler,
    options?: BlockModeOptions
  ): Promise<void> {
    await this.run(sectionLocator, handler, null, beforeHandler, null, options);
  }

  /**
   * 运行 Page 模式（内部方法）
   */
  async runPageMode(handler: PageHandler): Promise<void> {
    await this.run(null, null, handler, undefined, null);
  }

  /**
   * 运行测试模式（内部方法）
   */
  async runTestMode(
    url: string,
    sectionLocator: string,
    sectionIndex: number | undefined,
    blockName: string | undefined,
    handler: TestHandler,
    beforeHandler?: BeforeProcessBlocksHandler
  ): Promise<void> {
    await this.run(null, null, null, undefined, {
      url,
      sectionLocator,
      sectionIndex,
      blockName,
      handler,
      beforeHandler,
    });
  }

  /**
   * 运行爬虫（内部方法）
   */
  private async run(
    blockSectionLocator: string | null,
    blockHandler: BlockHandler | null,
    pageHandler: PageHandler | null,
    beforeProcessBlocks: BeforeProcessBlocksHandler | undefined,
    testMode: {
      url: string;
      sectionLocator: string;
      sectionIndex?: number;
      blockName?: string;
      handler: TestHandler;
      beforeHandler?: BeforeProcessBlocksHandler;
    } | null,
    blockModeOptions?: BlockModeOptions
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
        beforeProcessBlocks || null,
        testMode,
        blockModeOptions
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
