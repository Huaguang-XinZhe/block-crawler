import path from "path";
import type { CrawlerConfig } from "../types";

/**
 * 内部配置接口
 */
export interface InternalConfig extends Required<Omit<CrawlerConfig, 
  'tabListAriaLabel' | 'tabSectionLocator' | 'getTabSection' | 'getAllTabSections' | 'extractTabTextFromSection' |
  'getAllBlocks' | 'getBlockName' | 'extractBlockCount' | 'outputDir' | 'stateDir' | 'blockNameLocator' | 
  'startUrlWaitOptions' | 'collectionLinkWaitOptions' | 'collectionNameLocator' | 'collectionCountLocator' |
  'skipPageFree' | 'skipBlockFree'>> {
  tabListAriaLabel?: string;
  tabSectionLocator?: string;
  getTabSection?: CrawlerConfig['getTabSection'];
  getAllTabSections?: CrawlerConfig['getAllTabSections'];
  extractTabTextFromSection?: CrawlerConfig['extractTabTextFromSection'];
  getAllBlocks?: CrawlerConfig['getAllBlocks'];
  getBlockName?: CrawlerConfig['getBlockName'];
  extractBlockCount?: CrawlerConfig['extractBlockCount'];
  skipPageFree?: CrawlerConfig['skipPageFree'];
  skipBlockFree?: CrawlerConfig['skipBlockFree'];
  collectionNameLocator?: string;
  collectionCountLocator?: string;
  outputDir: string;
  stateDir: string;
  progressFile: string;
  metaFile: string;
  blockNameLocator: string;
  startUrlWaitOptions?: CrawlerConfig['startUrlWaitOptions'];
  collectionLinkWaitOptions?: CrawlerConfig['collectionLinkWaitOptions'];
  /** 域名（用于子目录划分） */
  hostname: string;
}

/**
 * 配置管理器
 * 职责：处理配置的生成和验证
 */
export class ConfigManager {
  /**
   * 从 URL 提取域名
   */
  static extractHostname(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace(/\./g, "-");
    } catch (error) {
      console.warn("⚠️ 解析 startUrl 失败，使用默认域名");
      return "default";
    }
  }

  /**
   * 验证配置是否存在冲突
   */
  private static validateConfig(config: CrawlerConfig): void {
    // 冲突 1: getAllTabSections 不能与 tab 点击相关配置同时使用
    if (config.getAllTabSections) {
      const conflicts: string[] = [];
      
      if (config.tabListAriaLabel) {
        conflicts.push("tabListAriaLabel");
      }
      if (config.getTabSection) {
        conflicts.push("getTabSection");
      }
      if (config.tabSectionLocator) {
        conflicts.push("tabSectionLocator");
      }
      
      if (conflicts.length > 0) {
        throw new Error(
          `❌ 配置冲突：getAllTabSections 不能与以下配置同时使用：\n` +
          `   - ${conflicts.join("\n   - ")}\n\n` +
          `原因：\n` +
          `  • getAllTabSections 会跳过 tab 点击逻辑，直接获取所有 tab sections\n` +
          `  • ${conflicts.join("、")} 用于处理需要点击 tab 的场景\n\n` +
          `请选择以下方案之一：\n\n` +
          `方案 1：使用 getAllTabSections（适合不需要点击 tab 的场景）\n` +
          `const crawler = new BlockCrawler({\n` +
          `  getAllTabSections: async (page) => page.locator('section').all(),\n` +
          `  extractTabTextFromSection: async (section) => section.getByRole('heading').textContent(),\n` +
          `});\n\n` +
          `方案 2：使用 tab 点击逻辑（适合需要切换 tab 的场景）\n` +
          `const crawler = new BlockCrawler({\n` +
          `  tabListAriaLabel: "Categories",\n` +
          `  getTabSection: (page, tabText) => page.getByRole("tabpanel", { name: tabText }),\n` +
          `});\n`
        );
      }
    }

    // 注意：以下配置可以共存，因为它们有优先级关系
    // 
    // ✅ 允许共存的配置组：
    // 1. getBlockName 和 blockNameLocator（函数优先）
    // 2. extractBlockCount 和默认逻辑（函数优先）
    // 3. extractTabTextFromSection 和默认查找 heading（函数优先）
    // 4. getAllBlocks 和 blockSectionLocator（在不同场景下使用，getAllBlocks 在 Block 处理器中优先）
  }

  /**
   * 从用户配置创建内部配置
   */
  static createInternalConfig(config: CrawlerConfig): InternalConfig {
    // 验证配置冲突
    this.validateConfig(config);

    // 提取域名用于目录划分
    const hostname = this.extractHostname(config.startUrl);
    
    // 目录结构：
    // - .crawler/域名/progress.json
    // - .crawler/域名/meta.json
    // - output/域名/
    const stateDir = config.stateDir ?? ".crawler";
    const outputBaseDir = config.outputDir ?? "output";
    const outputDir = path.join(outputBaseDir, hostname);
    const progressFile = path.join(stateDir, hostname, "progress.json");
    const metaFile = path.join(stateDir, hostname, "meta.json");

    return {
      startUrl: config.startUrl,
      tabListAriaLabel: config.tabListAriaLabel,
      tabSectionLocator: config.tabSectionLocator,
      getTabSection: config.getTabSection,
      getAllTabSections: config.getAllTabSections,
      extractTabTextFromSection: config.extractTabTextFromSection,
      getAllBlocks: config.getAllBlocks,
      getBlockName: config.getBlockName,
      extractBlockCount: config.extractBlockCount,
      skipPageFree: config.skipPageFree,
      skipBlockFree: config.skipBlockFree,
      maxConcurrency: config.maxConcurrency ?? 5,
      outputDir,
      stateDir,
      progressFile,
      metaFile,
      blockNameLocator: config.blockNameLocator ?? "role=heading[level=1] >> role=link",
      enableProgressResume: config.enableProgressResume ?? true,
      startUrlWaitOptions: config.startUrlWaitOptions,
      collectionLinkWaitOptions: config.collectionLinkWaitOptions,
      collectionLinkLocator: config.collectionLinkLocator,
      collectionNameLocator: config.collectionNameLocator,
      collectionCountLocator: config.collectionCountLocator,
      hostname,
    };
  }

}

