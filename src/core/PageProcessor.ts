import type { Page } from "@playwright/test";
import type { PageHandler, PageContext } from "../types";
import type { InternalConfig } from "./ConfigManager";

/**
 * Page 处理器
 * 职责：处理单个页面
 */
export class PageProcessor {
  constructor(
    private config: InternalConfig,
    private pageHandler: PageHandler
  ) {}

  /**
   * 处理单个页面
   */
  async processPage(page: Page, currentPath: string): Promise<void> {
    console.log(`\n📄 正在处理页面: ${currentPath}`);

    const context: PageContext = {
      currentPage: page,
      currentPath,
      outputDir: this.config.outputDir,
    };

    try {
      await this.pageHandler(context);
      console.log(`✅ 页面处理完成: ${currentPath}`);
    } catch (error) {
      console.error(`❌ 处理页面失败: ${currentPath}`, error);
      throw error;
    }
  }
}

