import type { Page, Locator } from "@playwright/test";

/**
 * 爬虫配置接口
 */
export interface CrawlerConfig {
  /** 起始 URL */
  startUrl: string;
  /** TabList 的 aria-label，用于定位分类标签，如果不传则获取第一个 tablist */
  tabListAriaLabel?: string;
  /**
   * Tab 对应的 section 内容区域定位符
   * 如果配置了此项，将使用配置的定位符；否则需要子类重写 getTabSection 方法
   * 
   * 支持占位符：
   * - {tabText}: tab 的文本内容
   * 
   * @example 'section:has(h2:text("{tabText}"))' (使用 tabText 占位符)
   * @example '[role="tabpanel"][aria-label="{tabText}"]' (shadcndesign)
   */
  tabSectionLocator?: string;
  /**
   * 自定义获取 Tab Section 的函数
   * 如果同时配置了 tabSectionLocator 和 getTabSection，优先使用此函数
   * 
   * @example (page, tabText) => page.getByRole("tabpanel", { name: tabText })
   */
  getTabSection?: (page: Page, tabText: string) => Locator;
  /** 
   * 最大并发页面数量
   * @default 5
   */
  maxConcurrency?: number;
  /** 输出目录 */
  outputDir?: string;
  /** 
   * 配置目录（用于存放 progress.json 等文件）
   * @default '.crawler'
   */
  configDir?: string;
  /** 
   * Block 名称定位符，用于获取 Block 名称
   * @default 'role=heading[level=1] >> role=link'
   */
  blockNameLocator?: string;
  /** 是否启用进度恢复功能 */
  enableProgressResume?: boolean;

  // ========== 等待配置 ==========
  /**
   * 访问起始 URL 后的等待选项
   * @example { waitUntil: 'networkidle' }
   * @example { waitUntil: 'domcontentloaded' }
   */
  startUrlWaitOptions?: {
    waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
    timeout?: number;
  };
  /**
   * 访问集合链接后的等待选项
   * @example { waitUntil: 'networkidle' }
   */
  collectionLinkWaitOptions?: {
    waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
    timeout?: number;
  };
  
  // ========== 链接收集定位符配置 ==========
  /**
   * 集合链接容器定位符（在容器下查找所有链接）
   * 必须配置，每个网站的 DOM 结构不同
   * @example 'section > a' (heroui-pro)
   * @example 'role=link' (shadcndesign)
   */
  collectionLinkLocator: string;
  /**
   * 集合名称定位符（在链接元素下查找名称）
   * 必须配置，每个网站的 DOM 结构不同
   * @example 'xpath=/div[2]/div[1]/div[1]' (heroui-pro)
   * @example '[data-slot="card-title"]' (shadcndesign)
   */
  collectionNameLocator: string;
  /**
   * 集合数量文本定位符（在链接元素下查找数量文本）
   * 必须配置，每个网站的 DOM 结构不同
   * @example 'xpath=/div[2]/div[1]/div[2]' (heroui-pro)
   * @example 'p' (shadcndesign)
   */
  collectionCountLocator: string;
}

/**
 * 页面处理上下文
 */
export interface PageContext {
  /** 当前正在处理的页面（可能是 newPage，而不是原始测试 page） */
  currentPage: Page;
  /** 当前路径（相对路径） */
  currentPath: string;
  /** 输出目录 */
  outputDir: string;
}

/**
 * Block 处理上下文
 */
export interface BlockContext {
  /** 当前正在处理的页面（可能是 newPage，而不是原始测试 page） */
  currentPage: Page;
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

