import crypto from "crypto";
import path from "path";
import fse from "fs-extra";
import type { CrawlerConfig } from "../types";

/**
 * 内部配置接口
 */
export interface InternalConfig extends Required<Omit<CrawlerConfig, 
  'tabListAriaLabel' | 'tabSectionLocator' | 'getTabSection' | 'getAllTabTexts' | 
  'getAllBlocks' | 'getBlockName' | 'outputDir' | 'configDir' | 'blockNameLocator' | 
  'startUrlWaitOptions' | 'collectionLinkWaitOptions'>> {
  tabListAriaLabel?: string;
  tabSectionLocator?: string;
  getTabSection?: CrawlerConfig['getTabSection'];
  getAllTabTexts?: CrawlerConfig['getAllTabTexts'];
  getAllBlocks?: CrawlerConfig['getAllBlocks'];
  getBlockName?: CrawlerConfig['getBlockName'];
  outputDir: string;
  configDir: string;
  progressFile: string;
  blockNameLocator: string;
  startUrlWaitOptions?: CrawlerConfig['startUrlWaitOptions'];
  collectionLinkWaitOptions?: CrawlerConfig['collectionLinkWaitOptions'];
}

/**
 * 配置管理器
 * 职责：处理配置的生成、验证、保存和加载
 */
export class ConfigManager {
  /**
   * 根据 URL 生成唯一的进度文件名
   */
  static generateProgressFileName(url: string): string {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      const pathname = urlObj.pathname;
      
      // 使用 pathname 的 hash 来区分同一域名下的不同路径
      const pathHash = crypto.createHash("md5").update(pathname).digest("hex").slice(0, 8);
      
      return `progress-${hostname.replace(/\./g, "-")}-${pathHash}.json`;
    } catch (error) {
      console.warn("⚠️ 解析 startUrl 失败，使用默认进度文件名");
      return "progress.json";
    }
  }

  /**
   * 根据 URL 生成唯一的输出目录名
   */
  static generateOutputDir(url: string): string {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      const pathname = urlObj.pathname;
      
      // 使用 pathname 的 hash 来区分同一域名下的不同路径
      const pathHash = crypto.createHash("md5").update(pathname).digest("hex").slice(0, 6);
      
      return `output/${hostname.replace(/\./g, "-")}-${pathHash}`;
    } catch (error) {
      console.warn("⚠️ 解析 startUrl 失败，使用默认输出目录");
      return "output";
    }
  }

  /**
   * 从用户配置创建内部配置
   */
  static createInternalConfig(config: CrawlerConfig): InternalConfig {
    const configDir = config.configDir ?? ".crawler";
    const progressFileName = this.generateProgressFileName(config.startUrl);
    const outputDir = config.outputDir ?? this.generateOutputDir(config.startUrl);

    return {
      startUrl: config.startUrl,
      tabListAriaLabel: config.tabListAriaLabel,
      tabSectionLocator: config.tabSectionLocator,
      getTabSection: config.getTabSection,
      getAllTabTexts: config.getAllTabTexts,
      getAllBlocks: config.getAllBlocks,
      getBlockName: config.getBlockName,
      maxConcurrency: config.maxConcurrency ?? 5,
      outputDir,
      configDir,
      progressFile: path.join(configDir, progressFileName),
      blockNameLocator: config.blockNameLocator ?? "role=heading[level=1] >> role=link",
      enableProgressResume: config.enableProgressResume ?? true,
      startUrlWaitOptions: config.startUrlWaitOptions,
      collectionLinkWaitOptions: config.collectionLinkWaitOptions,
      collectionLinkLocator: config.collectionLinkLocator,
      collectionNameLocator: config.collectionNameLocator,
      collectionCountLocator: config.collectionCountLocator,
    };
  }

  /**
   * 保存配置到文件
   */
  static async saveConfig(config: InternalConfig, configPath: string): Promise<void> {
    const configToSave: CrawlerConfig = {
      startUrl: config.startUrl,
      tabListAriaLabel: config.tabListAriaLabel,
      tabSectionLocator: config.tabSectionLocator,
      maxConcurrency: config.maxConcurrency,
      outputDir: config.outputDir,
      configDir: config.configDir,
      blockNameLocator: config.blockNameLocator,
      enableProgressResume: config.enableProgressResume,
      startUrlWaitOptions: config.startUrlWaitOptions,
      collectionLinkWaitOptions: config.collectionLinkWaitOptions,
      collectionLinkLocator: config.collectionLinkLocator,
      collectionNameLocator: config.collectionNameLocator,
      collectionCountLocator: config.collectionCountLocator,
    };

    await fse.outputJson(configPath, configToSave, { spaces: 2 });
    console.log(`✅ 配置已保存到: ${configPath}`);
    console.log(`📝 进度文件将保存到: ${config.progressFile}`);
  }

  /**
   * 从文件加载配置
   */
  static async loadConfig(configPath: string = ".crawler/config.json"): Promise<CrawlerConfig> {
    try {
      const config = await fse.readJson(configPath);
      console.log(`✅ 配置已从文件加载: ${configPath}`);
      return config;
    } catch (error) {
      throw new Error(`无法加载配置文件 ${configPath}: ${error}`);
    }
  }
}

