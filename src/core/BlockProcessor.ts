import type { Page, Locator } from "@playwright/test";
import type { BlockHandler, BlockContext } from "../types";
import type { InternalConfig } from "./ConfigManager";
import type { TaskProgress } from "../utils/task-progress";
import { createI18n, type I18n } from "../utils/i18n";
import { BlockNameExtractor } from "./BlockNameExtractor";

/**
 * Block 处理器
 * 职责：处理所有与 Block 相关的操作
 */
export class BlockProcessor {
  private i18n: I18n;
  private blockNameExtractor: BlockNameExtractor;
  
  constructor(
    private config: InternalConfig,
    private blockSectionLocator: string,
    private blockHandler: BlockHandler,
    private taskProgress?: TaskProgress,
    private beforeProcessBlocks?: ((page: Page) => Promise<void>) | null
  ) {
    this.i18n = createI18n(config.locale);
    this.blockNameExtractor = new BlockNameExtractor(config);
  }

  /**
   * 处理页面中的所有 Blocks
   */
  async processBlocksInPage(page: Page, pagePath: string): Promise<{
    totalCount: number;
    freeBlocks: string[];
    isPageFree?: boolean;
  }> {
    // 先检查整个页面是否为 Free（尽早跳过，提高效率）
    const isPageFree = await this.isPageFree(page);
    if (isPageFree) {
      console.log(this.i18n.t('page.skipFree', { path: pagePath }));
      // 标记页面为完成（虽然跳过了处理）
      const normalizedPath = this.normalizePagePath(pagePath);
      this.taskProgress?.markPageComplete(normalizedPath);
      // 返回页面为 Free 的标记
      return {
        totalCount: 0,
        freeBlocks: [],
        isPageFree: true,
      };
    }

    // 执行前置逻辑（如果配置了）
    if (this.beforeProcessBlocks) {
      await this.beforeProcessBlocks(page);
    }
    
    // 获取所有 block 节点
    const blocks = await this.getAllBlocks(page);
    console.log(this.i18n.t('block.found', { count: blocks.length }));

    let completedCount = 0;
    const freeBlocks: string[] = [];

    // 遍历处理每个 block
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const result = await this.processSingleBlock(page, block, pagePath);
      
      if (result.success) {
        completedCount++;
      }
      
      if (result.isFree && result.blockName) {
        freeBlocks.push(result.blockName);
      }
    }

    // 如果所有 block 都已完成，标记页面为完成
    if (completedCount === blocks.length && blocks.length > 0) {
      const normalizedPath = this.normalizePagePath(pagePath);
      this.taskProgress?.markPageComplete(normalizedPath);
      console.log(this.i18n.t('block.pageComplete', { total: blocks.length }));
    }

    return {
      totalCount: blocks.length,
      freeBlocks,
      isPageFree: false,
    };
  }

  /**
   * 检查整个页面是否为 Free
   */
  private async isPageFree(page: Page): Promise<boolean> {
    if (!this.config.skipFree) {
      return false;
    }

    // 字符串配置：使用 getByText 精确匹配
    if (typeof this.config.skipFree === "string") {
      const count = await page.getByText(this.config.skipFree, { exact: true }).count();
      return count > 0;
    }
    
    // 函数配置：使用自定义判断逻辑
    return await this.config.skipFree(page);
  }

  /**
   * 检查单个 Block 是否为 Free
   */
  private async isBlockFree(block: Locator): Promise<boolean> {
    if (!this.config.skipFree) {
      return false;
    }

    // 字符串配置：使用 getByText 精确匹配
    if (typeof this.config.skipFree === "string") {
      const count = await block.getByText(this.config.skipFree, { exact: true }).count();
      
      if (count === 0) {
        return false;
      }
      
      if (count !== 1) {
        throw new Error(this.i18n.t('block.freeError', { count, text: this.config.skipFree }));
      }
      
      return true;
    }
    
    // 函数配置：使用自定义判断逻辑
    return await this.config.skipFree(block);
  }

  /**
   * 处理单个 Block
   */
  private async processSingleBlock(
    page: Page,
    block: Locator,
    urlPath: string
  ): Promise<{ success: boolean; isFree: boolean; blockName?: string }> {
    // 获取 block 名称
    const blockName = await this.getBlockName(block);

    if (!blockName) {
      console.warn(this.i18n.t('block.nameEmpty'));
      return { success: false, isFree: false };
    }

    // 检查是否为 Free Block
    const isFree = await this.isBlockFree(block);
    if (isFree) {
      console.log(this.i18n.t('block.skipFree', { name: blockName }));
      // 如果是 Free Block，直接跳过处理
      return { success: true, isFree: true, blockName };
    }

    // 构建 blockPath
    const normalizedUrlPath = this.normalizePagePath(urlPath);
    const blockPath = `${normalizedUrlPath}/${blockName}`;

    // 检查是否已完成
    if (this.taskProgress?.isBlockComplete(blockPath)) {
      console.log(this.i18n.t('block.skip', { name: blockName }));
      return { success: true, isFree: false, blockName };
    }

    const context: BlockContext = {
      currentPage: page,
      block,
      blockPath,
      blockName,
      outputDir: this.config.outputDir,
    };

    try {
      // 只有非 Free Block 才调用 blockHandler
      await this.blockHandler(context);
      this.taskProgress?.markBlockComplete(blockPath);
      return { success: true, isFree: false, blockName };
    } catch (error) {
      console.error(this.i18n.t('block.processFailed', { name: blockName }), error);
      return { success: false, isFree: false, blockName };
    }
  }

  /**
   * 获取所有 Block 元素
   * 
   * 优先级：
   * 1. 配置的 getAllBlocks 函数
   * 2. 使用 blockSectionLocator
   */
  private async getAllBlocks(page: Page): Promise<Locator[]> {
    if (this.config.getAllBlocks) {
      console.log(`  ${this.i18n.t('block.getAllCustom')}`);
      return await this.config.getAllBlocks(page);
    }

    return await page.locator(this.blockSectionLocator).all();
  }

  /**
   * 获取 Block 名称
   * 使用 BlockNameExtractor 统一处理
   */
  private async getBlockName(block: Locator): Promise<string | null> {
    return await this.blockNameExtractor.extract(block);
  }

  /**
   * 标准化页面路径
   */
  private normalizePagePath(link: string): string {
    return link.startsWith("/") ? link.slice(1) : link;
  }
}

