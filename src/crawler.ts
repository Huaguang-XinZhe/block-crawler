import type { Page, Locator } from "@playwright/test";
import pLimit from "p-limit";
import fse from "fs-extra";
import path from "path";
import crypto from "crypto";
import { TaskProgress } from "./utils/task-progress";
import type {
  CrawlerConfig,
  PageHandler,
  BlockHandler,
  PageContext,
  BlockContext,
  CollectionLink,
} from "./types";

/**
 * Block 爬虫核心类
 * 支持两种模式：
 * 1. 单页面处理模式（不传 blockLocator）
 * 2. 单 Block 处理模式（传 blockLocator）
 */
interface InternalConfig {
  startUrl: string;
  tabListAriaLabel?: string;
  maxConcurrency: number;
  outputDir: string;
  configDir: string;
  progressFile: string;
  blockLocator?: string;
  blockNameLocator: string;
  enableProgressResume: boolean;
}

export class BlockCrawler {
  private config: InternalConfig;
  private pageHandler?: PageHandler;
  private blockHandler?: BlockHandler;
  private taskProgress?: TaskProgress;
  private limit: ReturnType<typeof pLimit>;
  private allCollectionLinks: CollectionLink[] = [];
  private totalBlockCount = 0;

  constructor(config: CrawlerConfig) {
    // 设置默认配置
    const configDir = config.configDir ?? ".crawler";
    
    // 根据 startUrl 生成唯一的进度文件名
    const progressFileName = this.generateProgressFileName(config.startUrl);
    
    this.config = {
      startUrl: config.startUrl,
      tabListAriaLabel: config.tabListAriaLabel,
      maxConcurrency: config.maxConcurrency ?? 5,
      outputDir: config.outputDir ?? "output",
      configDir,
      progressFile: path.join(configDir, progressFileName),
      blockLocator: config.blockLocator,
      blockNameLocator:
        config.blockNameLocator ?? "role=heading[level=1] >> role=link",
      enableProgressResume: config.enableProgressResume ?? true,
    };

    this.limit = pLimit(this.config.maxConcurrency);

    // 如果启用进度恢复，创建任务进度管理器
    if (this.config.enableProgressResume) {
      this.taskProgress = new TaskProgress(
        this.config.progressFile,
        this.config.outputDir
      );
    }
  }

  /**
   * 根据 URL 生成唯一的进度文件名
   */
  private generateProgressFileName(url: string): string {
    try {
      const urlObj = new URL(url);
      // 使用 hostname + pathname 的前8位 hash 来生成唯一标识
      const identifier = `${urlObj.hostname}${urlObj.pathname}`;
      const hash = crypto
        .createHash("md5")
        .update(identifier)
        .digest("hex")
        .substring(0, 8);
      
      // 使用 hostname 和 hash 组合，既直观又唯一
      const sanitizedHost = urlObj.hostname.replace(/[^a-z0-9]/gi, "-");
      return `progress-${sanitizedHost}-${hash}.json`;
    } catch (error) {
      // 如果 URL 解析失败，使用完整 URL 的 hash
      const hash = crypto.createHash("md5").update(url).digest("hex").substring(0, 8);
      return `progress-${hash}.json`;
    }
  }

  /**
   * 从配置文件创建爬虫实例
   * @param configPath 配置文件路径，默认为 '.crawler/config.json'
   */
  static async fromConfigFile(configPath: string = ".crawler/config.json"): Promise<BlockCrawler> {
    if (!(await fse.pathExists(configPath))) {
      throw new Error(`配置文件不存在: ${configPath}`);
    }

    const config = await fse.readJson(configPath);
    return new BlockCrawler(config);
  }

  /**
   * 保存配置到文件
   * @param configPath 配置文件路径，默认为 '.crawler/config.json'
   */
  async saveConfigFile(configPath: string = ".crawler/config.json"): Promise<void> {
    const configToSave: CrawlerConfig = {
      startUrl: this.config.startUrl,
      tabListAriaLabel: this.config.tabListAriaLabel,
      maxConcurrency: this.config.maxConcurrency,
      outputDir: this.config.outputDir,
      configDir: this.config.configDir,
      blockLocator: this.config.blockLocator,
      blockNameLocator: this.config.blockNameLocator,
      enableProgressResume: this.config.enableProgressResume,
    };

    await fse.outputJson(configPath, configToSave, { spaces: 2 });
    console.log(`✅ 配置已保存到: ${configPath}`);
    console.log(`📝 进度文件将保存到: ${this.config.progressFile}`);
  }

  /**
   * 设置页面处理器（单页面模式）
   */
  onPage(handler: PageHandler): this {
    this.pageHandler = handler;
    return this;
  }

  /**
   * 设置 Block 处理器（单 Block 模式）
   */
  onBlock(handler: BlockHandler): this {
    this.blockHandler = handler;
    return this;
  }

  /**
   * 运行爬虫
   */
  async run(page: Page): Promise<void> {
    console.log("\n🚀 ===== 开始执行爬虫任务 =====");
    console.log(`📍 目标URL: ${this.config.startUrl}`);
    console.log(`⚙️  最大并发数: ${this.config.maxConcurrency}`);
    console.log(`📂 输出目录: ${this.config.outputDir}`);
    console.log(
      `🎯 运行模式: ${
        this.config.blockLocator ? "Block 处理模式" : "页面处理模式"
      }`
    );

    // 初始化任务进度
    if (this.taskProgress) {
      console.log("\n📊 初始化任务进度...");
      await this.taskProgress.initialize();
    }

    try {
      // 访问目标链接
      console.log("\n📡 正在访问目标链接...");
      await page.goto(this.config.startUrl);
      console.log("✅ 页面加载完成");

      // 获取所有分类标签
      console.log("\n📑 正在获取所有分类标签...");
      const tabs = await this.getAllTabs(page);
      console.log(`✅ 找到 ${tabs.length} 个分类标签`);

      // 循环处理每个 tab
      console.log("\n🔄 开始遍历所有分类标签...");
      for (let i = 0; i < tabs.length; i++) {
        const tab = tabs[i];
        console.log(`\n📌 [${i + 1}/${tabs.length}] 处理分类标签...`);
        await this.clickTab(tab, i);
        await this.handleSingleTab(page, tab);
      }

      console.log(`\n✨ 收集完成！总共 ${this.totalBlockCount} 个 blocks`);
      console.log(
        `📊 总共 ${this.allCollectionLinks.length} 个集合链接待处理\n`
      );

      // 并发处理所有链接
      console.log(
        `\n🚀 开始并发处理所有链接 (最大并发: ${this.config.maxConcurrency})...`
      );
      await this.concurrentHandleLinksByLimit(page);
      console.log("\n🎉 ===== 所有任务已完成 ===== \n");
    } catch (error) {
      console.error("\n❌ 处理过程中发生错误，正在保存进度...");
      throw error;
    } finally {
      // 保存最终进度
      if (this.taskProgress) {
        await this.taskProgress.saveProgress();
        console.log(
          `\n💾 进度已保存 (页面: ${this.taskProgress.getCompletedPageCount()}, blocks: ${this.taskProgress.getCompletedBlockCount()})`
        );
      }
    }
  }

  /**
   * 获取所有的 tab
   */
  private async getAllTabs(page: Page): Promise<Locator[]> {
    if (this.config.tabListAriaLabel) {
      const tabList = page.getByRole("tablist", {
        name: this.config.tabListAriaLabel,
      });
      return await tabList.getByRole("tab").all();
    } else {
      // 如果没有指定 aria-label，获取第一个 tablist
      const tabList = page.locator("role=tablist").first();
      return await tabList.getByRole("tab").all();
    }
  }

  /**
   * 点击 tab
   */
  private async clickTab(tab: Locator, index: number): Promise<void> {
    const text = await tab.textContent();

    // 第一个跳过点击（默认选中）
    if (index === 0) {
      console.log(`   ⏭️  跳过第一个标签 (默认选中): ${text}`);
      return;
    }

    console.log(`   🖱️  点击标签: ${text}`);
    await tab.click();
  }

  /**
   * 处理单个 tab
   */
  private async handleSingleTab(page: Page, tab: Locator): Promise<void> {
    const text = (await tab.textContent()) ?? "";
    console.log(`   🔍 正在处理分类: ${text}`);
    const section = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: text }) });

    // 收集所有的链接
    await this.collectAllLinks(section);
    console.log(`   ✅ 分类 [${text}] 处理完成`);
  }

  /**
   * 收集所有的链接
   */
  private async collectAllLinks(section: Locator): Promise<void> {
    // 获取子 section 中的所有 a 标签
    const aTags = await section.locator("section > a").all();
    console.log(`      🔗 找到 ${aTags.length} 个集合链接`);

    // 遍历，获取 a 标签内部的 block 集合名称、内部 block 个数、集合链接
    for (let i = 0; i < aTags.length; i++) {
      const aTag = aTags[i];

      // 通过 XPath 定位
      const blockCollectionName = await aTag
        .locator("xpath=/div[2]/div[1]/div[1]")
        .textContent();
      const blockCountText = await aTag
        .locator("xpath=/div[2]/div[1]/div[2]")
        .textContent();
      const collectionLink = await aTag.getAttribute("href");

      const blockCount = this.extractBlockCount(blockCountText);

      // 树状结构打印
      console.log(
        `      ├─ [${i + 1}/${aTags.length}] 📦 ${blockCollectionName}`
      );
      console.log(`      │  ├─ Path: ${collectionLink}`);
      console.log(`      │  └─ Count: ${blockCountText}`);

      this.totalBlockCount += blockCount;

      if (collectionLink) {
        this.allCollectionLinks.push({
          link: collectionLink,
          name: blockCollectionName || undefined,
          count: blockCount,
        });
      }
    }
  }

  /**
   * 工具函数，从 block 个数文本中提取 block 个数
   */
  private extractBlockCount(blockCountText: string | null): number {
    // 文本可能像这样：7 blocks、10 components
    // 匹配获取其中的数字
    const match = blockCountText?.match(/\d+/);
    return match ? parseInt(match[0] ?? "0") : 0;
  }

  /**
   * 并发处理所有链接
   */
  private async concurrentHandleLinksByLimit(page: Page): Promise<void> {
    const total = this.allCollectionLinks.length;
    let completed = 0;
    let skipped = 0;
    let failed = 0;

    console.log(`\n📦 开始处理 ${total} 个集合链接...`);

    await Promise.allSettled(
      this.allCollectionLinks.map((collectionLink, index) =>
        this.limit(async () => {
          const linkName =
            collectionLink.link.split("/").pop() || collectionLink.link;
          
          // 检查页面是否已完成
          const pagePath = this.normalizePagePath(collectionLink.link);
          if (this.taskProgress?.isPageComplete(pagePath)) {
            skipped++;
            console.log(
              `⏭️  [${completed + skipped + failed}/${total}] 跳过已完成页面: ${linkName}\n`
            );
            return;
          }

          try {
            await this.handleSingleLink(page, collectionLink.link, index === 0);
            completed++;
            console.log(
              `✅ [${completed + skipped + failed}/${total}] 完成: ${linkName}\n`
            );
          } catch (error) {
            failed++;
            console.error(
              `❌ [${completed + skipped + failed}/${total}] 失败: ${linkName}\n`,
              error
            );
            // 不重新抛出，继续处理其他任务
          }
        })
      )
    );

    console.log(`\n📊 处理完成统计:`);
    console.log(`   ✅ 新完成: ${completed}/${total}`);
    console.log(`   ⏭️  已跳过: ${skipped}/${total}`);
    console.log(`   ❌ 失败: ${failed}/${total}`);
  }

  /**
   * 标准化页面路径（移除前导斜杠）
   */
  private normalizePagePath(link: string): string {
    return link.startsWith("/") ? link.slice(1) : link;
  }

  /**
   * 处理单个链接
   */
  private async handleSingleLink(
    page: Page,
    relativeLink: string,
    isFirst: boolean
  ): Promise<void> {
    // 从 startUrl 中获取域名，然后再拼接
    const domain = new URL(this.config.startUrl).hostname;
    const url = `https://${domain}${relativeLink}`;

    // 如果是第一个链接，则使用原来的 page，否则新建一个 page
    const newPage = isFirst ? page : await page.context().newPage();

    try {
      await newPage.goto(url);

      // 根据是否传入 blockLocator 决定处理模式
      if (this.config.blockLocator) {
        // Block 处理模式
        await this.handleBlocksInPage(newPage, relativeLink);
      } else {
        // 页面处理模式
        await this.handlePage(newPage, relativeLink);
      }
    } finally {
      if (!isFirst) {
        console.log(`\n🔍 关闭页面: ${relativeLink}`);
        await newPage.close();
      }
    }
  }

  /**
   * 处理单个页面（页面模式）
   */
  private async handlePage(page: Page, currentPath: string): Promise<void> {
    if (!this.pageHandler) {
      console.warn("⚠️ 未设置页面处理器，跳过处理");
      return;
    }

    const context: PageContext = {
      page,
      currentPath,
      outputDir: this.config.outputDir,
    };

    await this.pageHandler(context);
  }

  /**
   * 处理页面中的所有 Blocks（Block 模式）
   */
  private async handleBlocksInPage(
    page: Page,
    pagePath: string
  ): Promise<void> {
    if (!this.blockHandler) {
      console.warn("⚠️ 未设置 Block 处理器，跳过处理");
      return;
    }

    // 拿到所有 block 节点
    const blocks = await this.getAllBlocks(page);

    // 遍历 blocks
    let completedCount = 0;
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const wasCompleted = await this.handleSingleBlock(page, block, pagePath);
      if (wasCompleted) {
        completedCount++;
      }
    }

    // 如果所有 block 都完成了，标记页面为已完成
    if (completedCount === blocks.length && blocks.length > 0) {
      const normalizedPath = this.normalizePagePath(pagePath);
      this.taskProgress?.markPageComplete(normalizedPath);
      console.log(`✨ 页面所有 block 已完成: ${normalizedPath}`);
    }
  }

  /**
   * 获取页面中的所有 Block 元素
   * 可以被子类覆盖以自定义获取逻辑
   */
  protected async getAllBlocks(page: Page): Promise<Locator[]> {
    return await page.locator(this.config.blockLocator!).all();
  }

  /**
   * 处理单个 Block
   * @returns 是否成功完成（包括已完成的）
   */
  private async handleSingleBlock(
    page: Page,
    block: Locator,
    urlPath: string
  ): Promise<boolean> {
    if (!this.blockHandler) {
      return false;
    }

    // 拿到 block 的名称
    const blockName = await this.getBlockName(block);

    if (!blockName) {
      console.warn("⚠️ block 名称为空，跳过");
      return false;
    }

    console.log(`\n🔍 正在处理 block: ${blockName}`);

    // 构建 blockPath
    const normalizedUrlPath = this.normalizePagePath(urlPath);
    const blockPath = `${normalizedUrlPath}/${blockName}`;

    // 检查是否已完成
    if (this.taskProgress?.isBlockComplete(blockPath)) {
      console.log(`⏭️  跳过已完成的 block: ${blockName}`);
      return true; // 已完成也算成功
    }

    const context: BlockContext = {
      page,
      block,
      blockPath,
      blockName,
      outputDir: this.config.outputDir,
    };

    try {
      await this.blockHandler(context);
      // 标记为已完成
      this.taskProgress?.markBlockComplete(blockPath);
      return true;
    } catch (error) {
      console.error(`❌ 处理 block 失败: ${blockName}`, error);
      return false;
    }
  }

  /**
   * 获取 Block 名称
   * 可以被子类覆盖以自定义获取逻辑
   */
  protected async getBlockName(block: Locator): Promise<string | null> {
    try {
      return await block.locator(this.config.blockNameLocator).textContent();
    } catch {
      // 如果获取失败，返回 null
      return null;
    }
  }

  /**
   * 获取任务进度管理器
   */
  getTaskProgress(): TaskProgress | undefined {
    return this.taskProgress;
  }

  /**
   * 获取配置
   */
  getConfig(): Readonly<InternalConfig> {
    return this.config;
  }
}
