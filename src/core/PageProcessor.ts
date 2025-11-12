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
   * 检查页面是否为 Free
   */
  private async isPageFree(page: Page): Promise<boolean> {
    if (!this.config.skipPageFree) {
      return false;
    }

    try {
      // 字符串配置：使用 getByText 精确匹配
      if (typeof this.config.skipPageFree === "string") {
        const count = await page.getByText(this.config.skipPageFree, { exact: true }).count();
        return count > 0;
      }
      
      // 函数配置：使用自定义判断逻辑
      return await this.config.skipPageFree(page);
    } catch (error) {
      console.warn(`⚠️ 检查 Free 页面失败:`, error);
      return false;
    }
  }

  /**
   * 处理单个页面
   */
  async processPage(page: Page, currentPath: string): Promise<{ isFree: boolean }> {
    console.log(`\n📄 正在处理页面: ${currentPath}`);

    // 检查是否为 Free 页面
    const isFree = await this.isPageFree(page);
    if (isFree) {
      console.log(`🆓 跳过 Free 页面: ${currentPath}`);
      return { isFree: true };
    }

    const context: PageContext = {
      currentPage: page,
      currentPath,
      outputDir: this.config.outputDir,
    };

    try {
      await this.pageHandler(context);
      console.log(`✅ 页面处理完成: ${currentPath}`);
      return { isFree: false };
    } catch (error) {
      console.error(`❌ 处理页面失败: ${currentPath}`, error);
      throw error;
    }
  }
}

