import type { Page, Locator } from "@playwright/test";
import type { InternalConfig } from "./ConfigManager";

/**
 * Tab 处理器
 * 职责：处理所有与 Tab 相关的操作
 */
export class TabProcessor {
  constructor(private config: InternalConfig) {}

  /**
   * 获取所有的 Tab 元素
   */
  async getAllTabs(page: Page): Promise<Locator[]> {
    if (this.config.tabListAriaLabel) {
      const tabList = page.getByRole("tablist", { name: this.config.tabListAriaLabel });
      return await tabList.getByRole("tab").all();
    } else {
      // 如果没有指定 aria-label，则获取第一个 tablist
      const tabList = page.getByRole("tablist").first();
      return await tabList.getByRole("tab").all();
    }
  }

  /**
   * 点击 Tab
   */
  async clickTab(tab: Locator, index: number): Promise<void> {
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
   * 获取 Tab 对应的 Section 内容区域
   * 
   * 优先级：
   * 1. 配置的 getTabSection 函数
   * 2. 配置的 tabSectionLocator
   * 3. 抛出错误
   */
  getTabSection(page: Page, tabText: string): Locator {
    // 优先级 1：配置的函数
    if (this.config.getTabSection) {
      console.log("  ✅ 使用配置的 getTabSection 函数");
      return this.config.getTabSection(page, tabText);
    }

    // 优先级 2：配置的定位符
    if (this.config.tabSectionLocator) {
      const locator = this.config.tabSectionLocator.replace("{tabText}", tabText);
      console.log(`  ✅ 使用配置的 tabSectionLocator: ${locator}`);
      return page.locator(locator);
    }

    // 优先级 3：未配置，报错
    throw new Error(
      "未配置 getTabSection 函数、tabSectionLocator 且未重写 getTabSection 方法！\n\n" +
        "请选择以下任一方式：\n\n" +
        "方式 1：配置 getTabSection 函数（推荐，最灵活）\n" +
        "const crawler = new BlockCrawler({\n" +
        "  getTabSection: (page, tabText) => page.getByRole('tabpanel', { name: tabText }),\n" +
        "  // ... 其他配置\n" +
        "});\n\n" +
        "方式 2：配置 tabSectionLocator（简单场景）\n" +
        "const crawler = new BlockCrawler({\n" +
        '  tabSectionLocator: \'[role="tabpanel"][aria-label="{tabText}"]\',\n' +
        "  // ... 其他配置\n" +
        "});"
    );
  }

  /**
   * 获取所有 Tab 的文本（如果配置了 getAllTabTexts）
   */
  async getAllTabTexts(page: Page): Promise<string[] | null> {
    if (this.config.getAllTabTexts) {
      return await this.config.getAllTabTexts(page);
    }
    return null;
  }
}

