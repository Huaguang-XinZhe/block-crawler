import type { Page } from "@playwright/test";
import { TaskProgress } from "./utils/task-progress";
import type {
  CrawlerConfig,
  PageHandler,
  BlockHandler,
} from "./types";
import { ConfigManager, type InternalConfig } from "./core/ConfigManager";
import { CrawlerOrchestrator } from "./core/CrawlerOrchestrator";

/**
 * Block 爬虫核心类
 * 
 * 支持两种模式：
 * 1. 单页面处理模式（使用 onPage）
 * 2. 单 Block 处理模式（使用 onBlock）
 * 
 * @example
 * // Page 模式
 * const crawler = new BlockCrawler({ startUrl: "...", ... });
 * await crawler.onPage(page, async ({ currentPage }) => { ... });
 * 
 * @example
 * // Block 模式
 * const crawler = new BlockCrawler({ startUrl: "...", ... });
 * await crawler.onBlock(page, "xpath=//div", async ({ block }) => { ... });
 */
export class BlockCrawler {
  private config: InternalConfig;
  private taskProgress?: TaskProgress;
  private pageHandler?: PageHandler;
  private blockHandler?: BlockHandler;
  private blockSectionLocator?: string;
  private orchestrator?: CrawlerOrchestrator;
  private signalHandler?: NodeJS.SignalsListener;

  constructor(config: CrawlerConfig) {
    // 创建内部配置
    this.config = ConfigManager.createInternalConfig(config);

    // 初始化进度管理器
    if (this.config.enableProgressResume) {
      this.taskProgress = new TaskProgress(
        this.config.progressFile,
        this.config.outputDir
      );
    }
  }


  /**
   * 设置页面处理器并运行爬虫（单页面模式）
   * 
   * @param page Playwright Page 实例
   * @param handler 页面处理函数
   * 
   * @example
   * await crawler.onPage(page, async ({ currentPage, currentPath }) => {
   *   const title = await currentPage.title();
   *   console.log(title);
   * });
   */
  async onPage(page: Page, handler: PageHandler): Promise<void> {
    this.pageHandler = handler;
    await this.run(page);
  }

  /**
   * 设置 Block 处理器并运行爬虫（单 Block 模式）
   * 
   * @param page Playwright Page 实例
   * @param blockSectionLocator Block 区域定位符（必传）
   * @param handler Block 处理函数
   * 
   * @example
   * await crawler.onBlock(page, "xpath=//main/div", async ({ block, blockName }) => {
   *   const code = await extractCodeFromBlock(block);
   *   await fse.outputFile(`output/${blockName}.tsx`, code);
   * });
   */
  async onBlock(
    page: Page,
    blockSectionLocator: string,
    handler: BlockHandler
  ): Promise<void> {
    this.blockSectionLocator = blockSectionLocator;
    this.blockHandler = handler;
    await this.run(page);
  }

  /**
   * 运行爬虫（内部方法）
   */
  private async run(page: Page): Promise<void> {
    this.orchestrator = new CrawlerOrchestrator(this.config, this.taskProgress);
    
    // 设置 Ctrl+C 信号处理器
    this.setupSignalHandlers();
    
    try {
      await this.orchestrator.run(
        page,
        this.blockSectionLocator || null,
        this.blockHandler || null,
        this.pageHandler || null
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
      console.log(`\n\n⚠️  收到 ${signal} 信号，正在保存进度和元信息...\n`);
      
      if (this.orchestrator) {
        try {
          await this.orchestrator.cleanup();
          console.log("\n✅ 进度和元信息已保存，程序退出\n");
        } catch (error) {
          console.error("\n❌ 保存失败:", error);
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
