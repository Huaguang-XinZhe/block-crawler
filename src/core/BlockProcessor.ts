import type { Page, Locator } from "@playwright/test";
import type { BlockHandler, BlockContext, BeforeContext } from "../types";
import type { InternalConfig } from "./ConfigManager";
import type { TaskProgress } from "../utils/task-progress";
import { createI18n, type I18n } from "../utils/i18n";
import { BlockNameExtractor } from "./BlockNameExtractor";
import { createSafeOutput } from "../utils/safe-output";
import type { FilenameMappingManager } from "../utils/filename-mapping";
import { createClickAndVerify, createClickCode } from "../utils/click-actions";
import { isDebugMode } from "../utils/debug";

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
    private beforeProcessBlocks?: ((context: BeforeContext) => Promise<void>) | null,
    private filenameMappingManager?: FilenameMappingManager,
    private verifyBlockCompletion: boolean = true
  ) {
    this.i18n = createI18n(config.locale);
    this.blockNameExtractor = new BlockNameExtractor(config);
  }

  /**
   * 处理页面中的所有 Blocks
   * 注意：调用此方法前应该已经在 CrawlerOrchestrator 中检查过页面级 Free
   */
  async processBlocksInPage(page: Page, pagePath: string): Promise<{
    totalCount: number;
    freeBlocks: string[];
  }> {
    // 执行前置逻辑（如果配置了）
    if (this.beforeProcessBlocks) {
      const clickAndVerify = createClickAndVerify(this.config.locale);
      const beforeContext: BeforeContext = {
        currentPage: page,
        clickAndVerify,
      };
      await this.beforeProcessBlocks(beforeContext);
    }
    
    // 获取所有 block 节点（作为预期数量）
    const blocks = await this.getAllBlocks(page);
    const expectedCount = blocks.length;
    console.log(this.i18n.t('block.found', { count: expectedCount }));

    let completedCount = 0;
    let processedCount = 0; // 实际处理的 block 数量（包括 free 和跳过的）
    const freeBlocks: string[] = [];
    const processedBlockNames: string[] = []; // 记录所有处理过的 block 名称

    // 遍历处理每个 block
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const result = await this.processSingleBlock(page, block, pagePath);
      
      if (result.blockName) {
        processedBlockNames.push(result.blockName);
      }
      
      processedCount++;
      
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

    // 验证 Block 采集完整性（如果启用）
    if (this.verifyBlockCompletion) {
      await this.verifyCompletion(
        page,
        pagePath,
        expectedCount,
        processedCount,
        processedBlockNames
      );
    }

    return {
      totalCount: blocks.length,
      freeBlocks,
    };
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

    const clickAndVerify = createClickAndVerify(this.config.locale);
    const context: BlockContext = {
      currentPage: page,
      block,
      blockPath,
      blockName,
      outputDir: this.config.outputDir,
      safeOutput: createSafeOutput('block', this.config.outputDir, this.filenameMappingManager, blockPath),
      clickAndVerify,
      clickCode: createClickCode(block, clickAndVerify),
    };

    try {
      // 只有非 Free Block 才调用 blockHandler
      await this.blockHandler(context);
      this.taskProgress?.markBlockComplete(blockPath);
      return { success: true, isFree: false, blockName };
    } catch (error) {
      // 如果开启了 pauseOnError，暂停页面方便检查
      if (this.config.pauseOnError) {
        const debugMode = isDebugMode();
        const messageKey = debugMode ? 'error.pauseOnErrorDebug' : 'error.pauseOnErrorNonDebug';
        
        console.error(this.i18n.t(messageKey, { 
          type: 'Block',
          name: blockName,
          path: '',
          error: error instanceof Error ? error.message : String(error)
        }));
        
        // 只在 debug 模式下暂停
        if (debugMode) {
          await page.pause();
        }
      }
      
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
   * 验证 Block 采集完整性
   * 如果预期数量与实际处理数量不一致，暂停并提示用户检查
   */
  private async verifyCompletion(
    page: Page,
    pagePath: string,
    expectedCount: number,
    processedCount: number,
    processedBlockNames: string[]
  ): Promise<void> {
    if (expectedCount !== processedCount) {
      const debugMode = isDebugMode();
      const messageKey = debugMode ? 'block.verifyIncompleteDebug' : 'block.verifyIncompleteNonDebug';
      
      console.error(
        this.i18n.t(messageKey, {
          pagePath,
          expectedCount,
          processedCount,
          diff: expectedCount - processedCount,
          blockList: processedBlockNames.map((name, idx) => `     ${idx + 1}. ${name}`).join('\n')
        })
      );
      
      // 只在 debug 模式下暂停
      if (debugMode) {
        await page.pause();
      }
    } else {
      console.log(
        this.i18n.t('block.verifyComplete', {
          pagePath,
          expectedCount,
          processedCount
        })
      );
    }
  }

  /**
   * 标准化页面路径
   */
  private normalizePagePath(link: string): string {
    return link.startsWith("/") ? link.slice(1) : link;
  }
}

