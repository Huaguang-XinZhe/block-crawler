import type { Page, Locator } from "@playwright/test";
import type { BlockHandler, BlockContext } from "../types";
import type { InternalConfig } from "./ConfigManager";
import type { TaskProgress } from "../utils/task-progress";

/**
 * Block 处理器
 * 职责：处理所有与 Block 相关的操作
 */
export class BlockProcessor {
  constructor(
    private config: InternalConfig,
    private blockSectionLocator: string,
    private blockHandler: BlockHandler,
    private taskProgress?: TaskProgress
  ) {}

  /**
   * 处理页面中的所有 Blocks
   */
  async processBlocksInPage(page: Page, pagePath: string): Promise<void> {
    console.log(`\n🔄 开始处理页面中的 blocks: ${pagePath}`);

    // 获取所有 block 节点
    const blocks = await this.getAllBlocks(page);
    console.log(`✅ 找到 ${blocks.length} 个 blocks`);

    let completedCount = 0;

    // 遍历处理每个 block
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const success = await this.processSingleBlock(page, block, pagePath);
      if (success) {
        completedCount++;
      }
    }

    // 如果所有 block 都已完成，标记页面为完成
    if (completedCount === blocks.length && blocks.length > 0) {
      const normalizedPath = this.normalizePagePath(pagePath);
      this.taskProgress?.markPageComplete(normalizedPath);
      console.log(`✨ 页面所有 block 已完成: ${normalizedPath}`);
    }
  }

  /**
   * 处理单个 Block
   */
  private async processSingleBlock(
    page: Page,
    block: Locator,
    urlPath: string
  ): Promise<boolean> {
    // 获取 block 名称
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
      return true;
    }

    const context: BlockContext = {
      currentPage: page,
      block,
      blockPath,
      blockName,
      outputDir: this.config.outputDir,
    };

    try {
      await this.blockHandler(context);
      this.taskProgress?.markBlockComplete(blockPath);
      return true;
    } catch (error) {
      console.error(`❌ 处理 block 失败: ${blockName}`, error);
      return false;
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
      console.log("  ✅ 使用配置的 getAllBlocks 函数");
      return await this.config.getAllBlocks(page);
    }

    return await page.locator(this.blockSectionLocator).all();
  }

  /**
   * 获取 Block 名称
   * 
   * 优先级：
   * 1. 配置的 getBlockName 函数
   * 2. 使用 blockNameLocator
   */
  private async getBlockName(block: Locator): Promise<string | null> {
    if (this.config.getBlockName) {
      return await this.config.getBlockName(block);
    }

    try {
      return await block.locator(this.config.blockNameLocator).textContent();
    } catch {
      return null;
    }
  }

  /**
   * 标准化页面路径
   */
  private normalizePagePath(link: string): string {
    return link.startsWith("/") ? link.slice(1) : link;
  }
}

