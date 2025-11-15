import type { Page } from "@playwright/test";
import type { PageHandler, PageContext } from "../types";
import type { InternalConfig } from "./ConfigManager";
import { createI18n, type I18n } from "../utils/i18n";
import { createSafeOutput } from "../utils/safe-output";
import type { FilenameMappingManager } from "../utils/filename-mapping";
import { isDebugMode } from "../utils/debug";

/**
 * Page 处理器
 * 职责：处理单个页面
 */
export class PageProcessor {
  private i18n: I18n;
  
  constructor(
    private config: InternalConfig,
    private pageHandler: PageHandler,
    private filenameMappingManager?: FilenameMappingManager
  ) {
    this.i18n = createI18n(config.locale);
  }

  /**
   * 检查页面是否为 Free（静态方法，供外部调用）
   */
  static async checkPageFree(page: Page, config: InternalConfig): Promise<boolean> {
    if (!config.skipFree) {
      return false;
    }

    // 字符串配置：使用 getByText 精确匹配
    if (typeof config.skipFree === "string") {
      const count = await page.getByText(config.skipFree, { exact: true }).count();
      
      if (count === 0) {
        return false;
      }
      
      if (count !== 1) {
        const i18n = createI18n(config.locale);
        throw new Error(i18n.t('page.freeError', { count, text: config.skipFree }));
      }
      
      return true;
    }
    
    // 函数配置：使用自定义判断逻辑
    return await config.skipFree(page);
  }

  /**
   * 处理单个页面
   * 注意：调用此方法前应该已经在 CrawlerOrchestrator 中检查过 Free 页面
   */
  async processPage(page: Page, currentPath: string): Promise<void> {
    const context: PageContext = {
      currentPage: page,
      currentPath,
      outputDir: this.config.outputDir,
      safeOutput: createSafeOutput('page', this.config.outputDir, this.filenameMappingManager),
    };

    try {
      await this.pageHandler(context);
    } catch (error) {
      // 如果开启了 pauseOnError，暂停页面方便检查
      if (this.config.pauseOnError) {
        const debugMode = isDebugMode();
        const messageKey = debugMode ? 'error.pauseOnErrorDebug' : 'error.pauseOnErrorNonDebug';
        
        console.error(this.i18n.t(messageKey, { 
          type: 'Page',
          name: '',
          path: currentPath,
          error: error instanceof Error ? error.message : String(error)
        }));
        
        // 只在 debug 模式下暂停
        if (debugMode) {
          await page.pause();
        }
      }
      
      throw error;
    }
  }
}

