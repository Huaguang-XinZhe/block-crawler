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
   * 从配置文件加载配置并创建爬虫实例
   * 
   * @param configPath 配置文件路径，默认为 '.crawler/config.json'
   * @example
   * const crawler = await BlockCrawler.fromConfigFile();
   * const crawler = await BlockCrawler.fromConfigFile(".crawler/my-config.json");
   */
  static async fromConfigFile(
    configPath: string = ".crawler/config.json"
  ): Promise<BlockCrawler> {
    const config = await ConfigManager.loadConfig(configPath);
    return new BlockCrawler(config);
  }

  /**
   * 保存当前配置到文件
   * 
   * @param configPath 配置文件路径，默认为 '.crawler/config.json'
   */
  async saveConfigFile(configPath: string = ".crawler/config.json"): Promise<void> {
    await ConfigManager.saveConfig(this.config, configPath);
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
    const orchestrator = new CrawlerOrchestrator(this.config, this.taskProgress);
    await orchestrator.run(
      page,
      this.blockSectionLocator || null,
      this.blockHandler || null,
      this.pageHandler || null
    );
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
   * 获取配置目录
   */
  get configDir(): string {
    return this.config.configDir;
  }

  /**
   * 获取进度文件路径
   */
  get progressFile(): string {
    return this.config.progressFile;
  }
}
