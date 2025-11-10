import type { Page, Locator } from "@playwright/test";

/**
 * 爬虫配置接口
 */
export interface CrawlerConfig {
  /** 起始 URL */
  startUrl: string;
  /** TabList 的 aria-label，用于定位分类标签，如果不传则获取第一个 tablist */
  tabListAriaLabel?: string;
  /** 最大并发页面数量 */
  maxConcurrency?: number;
  /** 输出目录 */
  outputDir?: string;
  /** 
   * 配置目录（用于存放 progress.json 等文件）
   * @default '.crawler'
   */
  configDir?: string;
  /** 
   * 进度文件名（相对于 configDir）
   * @default 'progress.json'
   */
  progressFileName?: string;
  /** Block 定位符（XPath 或 CSS 选择器），不传则表示处理单页面 */
  blockLocator?: string;
  /** 
   * Block 名称定位符，用于获取 Block 名称
   * @default 'role=heading[level=1] >> role=link'
   */
  blockNameLocator?: string;
  /** 是否启用进度恢复功能 */
  enableProgressResume?: boolean;
}

/**
 * 页面处理上下文
 */
export interface PageContext {
  /** 当前页面 */
  page: Page;
  /** 当前路径（相对路径） */
  currentPath: string;
  /** 输出目录 */
  outputDir: string;
}

/**
 * Block 处理上下文
 */
export interface BlockContext {
  /** 当前页面 */
  page: Page;
  /** Block 元素 */
  block: Locator;
  /** block 路径（URL 路径 + Block 名称） */
  blockPath: string;
  /** Block 名称 */
  blockName: string;
  /** 输出目录 */
  outputDir: string;
}

/**
 * 页面处理器函数类型
 */
export type PageHandler = (context: PageContext) => Promise<void>;

/**
 * Block 处理器函数类型
 */
export type BlockHandler = (context: BlockContext) => Promise<void>;

/**
 * 链接收集结果
 */
export interface CollectionLink {
  /** 链接地址 */
  link: string;
  /** 链接名称 */
  name?: string;
  /** Block 数量 */
  count?: number;
}

