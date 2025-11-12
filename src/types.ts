import type { Page, Locator } from "@playwright/test";
import type { Locale } from "./utils/i18n";

/**
 * 爬虫配置接口
 */
export interface CrawlerConfig {
  /** 起始 URL */
  startUrl: string;
  /** 语言设置，支持 'zh' (中文) 和 'en' (英文)，默认为 'zh' */
  locale?: Locale;
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
   * 获取所有 Tab Section 的函数
   * 如果配置了此函数，将跳过 tab 点击逻辑，直接获取所有 tab sections
   * 框架会自动从每个 section 中提取 tabText（通过查找 heading 元素）
   * 
   * 注意：如果单个 section 中存在多个 heading，框架会报错提示你自定义提取逻辑
   * 
   * @example async (page) => page.locator('section[data-tab-content]').all()
   * @example async (page) => page.locator('div.tab-panel').all()
   */
  getAllTabSections?: (page: Page) => Promise<Locator[]>;
  /**
   * 自定义从 Tab Section 中提取 Tab 文本的函数
   * 仅在配置了 getAllTabSections 时生效
   * 如果不配置，框架会自动查找 section 中的第一个 heading 元素
   * 
   * @param section 当前 tab section 的 Locator
   * @returns Tab 文本
   * @example async (section) => section.getByRole("heading", { level: 2 }).textContent()
   */
  extractTabTextFromSection?: (section: Locator) => Promise<string | null>;
  /**
   * 自定义获取所有 Block 元素的函数
   * 
   * @example async (page) => page.locator("xpath=//main/div/div/div").all()
   */
  getAllBlocks?: (page: Page) => Promise<Locator[]>;
  /**
   * 自定义获取 Block 名称的函数
   * 
   * @example async (block) => block.getByRole("heading", { level: 1 }).textContent()
   */
  getBlockName?: (block: Locator) => Promise<string | null>;
  /**
   * 自定义从文本中提取 Block 数量的函数
   * 如果提供了此函数，将优先使用；否则使用默认的数字匹配逻辑
   * 
   * @param blockCountText Block 数量文本（如 "7 blocks"、"1 component + 6 variants"）
   * @returns Block 数量
   * @example (text) => { const match = text?.match(/(\d+)\s*component.*?(\d+)\s*variant/); return match ? parseInt(match[1]) + parseInt(match[2]) : 0; }
   */
  extractBlockCount?: (blockCountText: string | null) => number;
  /** 
   * 最大并发页面数量
   * @default 5
   */
  maxConcurrency?: number;
  /** 
   * 输出目录（会自动在此目录下创建域名子目录）
   * @default 'output'
   */
  outputDir?: string;
  /** 
   * 状态目录（用于存放进度文件和网站元信息）
   * 会在此目录下为每个域名创建子目录，存放 progress.json 等
   * @default '.crawler'
   */
  stateDir?: string;
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
   * 集合名称定位符（在链接元素下查找名称）
   * 可选，如果不提供则只记录 link
   * @example 'xpath=/div[2]/div[1]/div[1]' (heroui-pro)
   * @example '[data-slot="card-title"]' (shadcndesign)
   */
  collectionNameLocator?: string;
  /**
   * 集合数量文本定位符（在链接元素下查找数量文本）
   * 可选，如果不提供则只记录 link
   * @example 'xpath=/div[2]/div[1]/div[2]' (heroui-pro)
   * @example 'p' (shadcndesign)
   */
  collectionCountLocator?: string;
  
  // ========== Free 过滤配置 ==========
  /**
   * 跳过 Free 页面的配置
   * - 字符串：使用 getByText(text, {exact: true}) 精确匹配文本
   * - 函数：自定义判断逻辑
   * @example "FREE" // 字符串配置
   * @example async (page) => (await page.getByText("FREE", {exact: true}).count()) > 0 // 函数配置
   */
  skipPageFree?: string | ((page: Page) => Promise<boolean>);
  /**
   * 跳过 Free Block 的配置
   * - 字符串：使用 getByText(text, {exact: true}) 精确匹配文本
   * - 函数：自定义判断逻辑
   * @example "Free" // 字符串配置
   * @example async (block) => (await block.getByText("Free", {exact: true}).count()) > 0 // 函数配置
   */
  skipBlockFree?: string | ((block: Locator) => Promise<boolean>);
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
  /** 是否为 Free 页面 */
  isFree?: boolean;
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

/**
 * Free 页面/Block 信息
 */
export interface FreeItem {
  /** 链接或 Block 名称 */
  name: string;
  /** 是否为 free */
  isFree: boolean;
}

/**
 * 网站元信息
 */
export interface SiteMeta {
  /** 起始 URL */
  startUrl: string;
  /** 所有收集到的链接 */
  collectionLinks: CollectionLink[];
  /** 收集到的链接总数 */
  totalLinks: number;
  /** 展示的总组件数（collectionCount 的加和） */
  displayedTotalCount: number;
  /** 真实的总组件数（实际爬取到的） */
  actualTotalCount: number;
  /** Free 页面信息 */
  freePages: {
    /** Free 页面总数 */
    total: number;
    /** 具体的 Free 页面 */
    links: string[];
  };
  /** Free Block 信息 */
  freeBlocks: {
    /** Free Block 总数 */
    total: number;
    /** 具体的 Free Block */
    blockNames: string[];
  };
  /** 是否完整运行（未中断/未发生错误） */
  isComplete: boolean;
  /** 本次运行耗时（秒） */
  duration?: number;
  /** 本次运行开始时间 */
  startTime?: string;
}

