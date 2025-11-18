import path from "path";
import type { CrawlerConfig } from "../types";
import { createI18n, type Locale } from "../utils/i18n";

/**
 * 内部配置接口
 */
export interface InternalConfig extends Required<Omit<CrawlerConfig, 
  'tabListAriaLabel' | 'tabSectionLocator' | 'getTabSection' | 'getAllTabSections' | 'extractTabTextFromSection' |
  'getAllBlocks' | 'getBlockName' | 'extractBlockCount' | 'outputDir' | 'stateDir' | 'blockNameLocator' | 
  'startUrlWaitOptions' | 'collectionLinkWaitOptions' | 'collectionNameLocator' | 'collectionCountLocator' |
  'skipFree' | 'locale' | 'scriptInjection' | 'pauseOnError' | 'useIndependentContext' | 'progress'>> {
  locale: Locale;
  pauseOnError: boolean;
  useIndependentContext: boolean;
  progress: Required<CrawlerConfig['progress']>;
  tabListAriaLabel?: string;
  tabSectionLocator?: string;
  getTabSection?: CrawlerConfig['getTabSection'];
  getAllTabSections?: CrawlerConfig['getAllTabSections'];
  extractTabTextFromSection?: CrawlerConfig['extractTabTextFromSection'];
  getAllBlocks?: CrawlerConfig['getAllBlocks'];
  getBlockName?: CrawlerConfig['getBlockName'];
  extractBlockCount?: CrawlerConfig['extractBlockCount'];
  skipFree?: CrawlerConfig['skipFree'];
  collectionNameLocator?: string;
  collectionCountLocator?: string;
  scriptInjection?: CrawlerConfig['scriptInjection'];
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
  static extractHostname(url: string, locale?: Locale): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (error) {
      const i18n = createI18n(locale);
      console.warn(i18n.t('config.parseUrlFailed'));
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

    // 冲突 2: scriptInjection 的 script 和 scripts 不能同时设置
    if (config.scriptInjection) {
      const { script, scripts } = config.scriptInjection;
      
      if (script && scripts && scripts.length > 0) {
        throw new Error(
          `❌ 配置冲突：scriptInjection 中的 script 和 scripts 不能同时设置\n\n` +
          `原因：\n` +
          `  • script（单数）：单个脚本，从 .crawler/域名/ 目录读取\n` +
          `  • scripts（复数）：多个脚本，从 .crawler/域名/scripts/ 目录读取\n\n` +
          `请选择以下方案之一：\n\n` +
          `方案 1：使用 script（单个脚本）\n` +
          `const crawler = new BlockCrawler({\n` +
          `  scriptInjection: {\n` +
          `    script: 'custom-script.js',  // 从 .crawler/域名/ 读取\n` +
          `    timing: 'afterPageLoad'\n` +
          `  }\n` +
          `});\n\n` +
          `方案 2：使用 scripts（多个脚本）\n` +
          `const crawler = new BlockCrawler({\n` +
          `  scriptInjection: {\n` +
          `    scripts: ['utils.js', 'helpers.js'],  // 从 .crawler/域名/scripts/ 读取\n` +
          `    timing: 'afterPageLoad'\n` +
          `  }\n` +
          `});\n`
        );
      }
      
      // 检查至少设置了一个
      if (!script && (!scripts || scripts.length === 0)) {
        throw new Error(
          `❌ 配置错误：scriptInjection 必须设置 script 或 scripts 之一\n\n` +
          `示例：\n` +
          `scriptInjection: {\n` +
          `  script: 'custom-script.js'  // 或\n` +
          `  scripts: ['utils.js']       // 或\n` +
          `}\n`
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
    const locale = (config.locale ?? 'zh') as Locale;
    const hostname = this.extractHostname(config.startUrl, locale);
    
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
      locale: config.locale ?? 'zh',
      pauseOnError: config.pauseOnError ?? true,
      useIndependentContext: config.useIndependentContext ?? false,
      progress: {
        enable: config.progress?.enable ?? true,
        rebuild: {
          blockType: config.progress?.rebuild?.blockType ?? 'file',
          saveToProgress: config.progress?.rebuild?.saveToProgress ?? true,
          checkBlockComplete: config.progress?.rebuild?.checkBlockComplete,
        },
      },
      tabListAriaLabel: config.tabListAriaLabel,
      tabSectionLocator: config.tabSectionLocator,
      getTabSection: config.getTabSection,
      getAllTabSections: config.getAllTabSections,
      extractTabTextFromSection: config.extractTabTextFromSection,
      getAllBlocks: config.getAllBlocks,
      getBlockName: config.getBlockName,
      extractBlockCount: config.extractBlockCount,
      skipFree: config.skipFree,
      scriptInjection: config.scriptInjection,
      maxConcurrency: config.maxConcurrency ?? 5,
      outputDir,
      stateDir: path.join(stateDir, hostname), // 修改：stateDir 应该包含域名子目录
      progressFile,
      metaFile,
      blockNameLocator: config.blockNameLocator ?? "role=heading[level=1] >> role=link",
      startUrlWaitOptions: config.startUrlWaitOptions,
      collectionLinkWaitOptions: config.collectionLinkWaitOptions,
      collectionNameLocator: config.collectionNameLocator,
      collectionCountLocator: config.collectionCountLocator,
      hostname,
    };
  }

}

