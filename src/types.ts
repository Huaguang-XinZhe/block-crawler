import type { Page, Locator } from "@playwright/test";
import type { Locale } from "./utils/i18n";
import type { SafeOutput } from "./utils/safe-output";

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
   * 如果提供了此函数，将优先使用；否则使用默认逻辑（匹配文本中的所有数字然后相加）
   * 
   * @param blockCountText Block 数量文本（如 "7 blocks"、"1 component + 6 variants"）
   * @returns Block 数量
   * @example
   * // 默认行为："7 blocks" → 7，"1 component + 6 variants" → 7
   * // 自定义示例：只提取特定格式
   * (text) => {
   *   const match = text?.match(/(\d+)\s*component/);
   *   return match ? parseInt(match[1]) : 0;
   * }
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
   * 跳过 Free 内容的配置（自动适配 Page 模式和 Block 模式）
   * 
   * **Page 模式：** 检查页面是否有 Free 标志，有则跳过整个页面
   * **Block 模式：**
   *   1. 先检查整个页面是否有 Free 标志（说明单个 block 没有 Free 标志），有则跳过所有 block
   *   2. 如果页面没有 Free 标志，再检查单个 block 是否有 Free 标志
   * 
   * - 字符串：使用 getByText(text, {exact: true}) 精确匹配文本
   * - 函数：自定义判断逻辑（接收 Page 或 Locator 参数）
   * 
   * @example "FREE" // 字符串配置
   * @example async (pageOrBlock) => (await pageOrBlock.getByText("FREE", {exact: true}).count()) > 0 // 函数配置
   */
  skipFree?: string | ((pageOrBlock: Page | Locator) => Promise<boolean>);
  
  // ========== 脚本注入配置 ==========
  /**
   * 脚本注入配置
   * 注意：startUrl 的 page 不会注入脚本，只有并发访问的链接 page 会注入
   * 
   * @example
   * {
   *   scripts: ['custom.js'],
   *   timing: 'afterPageLoad'
   * }
   */
  scriptInjection?: {
    /** 
     * 单个脚本文件名
     * 从 `.crawler/域名/` 目录读取
     * 
     * @example 'custom-script.js'
     */
    script?: string;
    /** 
     * 多个脚本文件名列表
     * 从 `.crawler/域名/scripts/` 目录读取
     * 
     * @example ['utils.js', 'helpers.js']
     */
    scripts?: string[];
    /** 
     * 脚本注入时机
     * - 'beforePageLoad': 在页面加载前注入（使用 addInitScript）
     * - 'afterPageLoad': 在页面加载后注入（在 goto 之后执行）
     * @default 'afterPageLoad'
     */
    timing?: 'beforePageLoad' | 'afterPageLoad';
  };

  // ========== 调试配置 ==========
  /**
   * 遇到错误时自动暂停（调试功能）
   * 
   * 当开启时，在处理过程中遇到错误（如 timeout、selector 错误等）会自动调用 page.pause()，
   * 方便开发者检查问题，而不是直接跳过继续执行。
   * 
   * 使用场景：
   * - 在 --debug 模式下运行时开启
   * - 生产环境建议关闭，避免阻塞流程
   * 
   * @default true
   * @example
   * // 调试时使用（默认）
   * const crawler = new BlockCrawler(page, {
   *   pauseOnError: true,  // 遇到错误自动暂停
   *   // ... 其他配置
   * });
   * 
   * // 生产环境关闭
   * const crawler = new BlockCrawler(page, {
   *   pauseOnError: false,  // 遇到错误继续执行
   *   // ... 其他配置
   * });
   */
  pauseOnError?: boolean;

  // ========== 并发配置 ==========
  /**
   * 使用独立的浏览器上下文（BrowserContext）
   * 
   * 当开启时，每个并发页面会创建独立的 BrowserContext，避免共享状态导致的并发问题。
   * debug 模式下会看到多个浏览器窗口（多个 renderer 进程）和调试器窗口，但只有一个浏览器（进程）❗
   * 
   * **优点：**
   * - 完全隔离，避免状态污染
   * - 点击、输入等操作更稳定
   * - 适合高并发场景
   * 
   * **缺点：**
   * - 内存占用略高
   * - 无法共享 cookies/storage
   * 
   * **使用场景：**
   * - 并发爬取多个页面时遇到点击失效、状态混乱
   * - 需要完全隔离的页面环境
   * 
   * @default false
   * @example
   * // 并发场景开启（推荐）
   * const crawler = new BlockCrawler(page, {
   *   useIndependentContext: true,
   *   maxConcurrency: 5,
   *   // ... 其他配置
   * });
   */
  useIndependentContext?: boolean;
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
  /** 安全输出函数（自动处理文件名 sanitize） */
  safeOutput: SafeOutput;
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
  /** 安全输出函数（自动处理文件名 sanitize，默认路径：${outputDir}/${blockPath}.tsx） */
  safeOutput: SafeOutput;
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
 * Block 处理前置函数类型
 * 在匹配页面所有 Block 之前执行的前置逻辑（如点击按钮、toggle 切换等）
 * 
 * @param currentPage 当前正在处理的页面（可能是 newPage，而不是原始测试 page）
 * 
 * @example
 * async (currentPage) => {
 *   await currentPage.getByRole('button', { name: 'Show All' }).click();
 *   await currentPage.waitForTimeout(500);
 * }
 */
export type BeforeProcessBlocksHandler = (currentPage: Page) => Promise<void>;

/**
 * 测试模式上下文
 */
export interface TestContext {
  /** 当前页面 */
  currentPage: Page;
  /** 目标 section */
  section: Locator;
  /** Block 名称 */
  blockName: string;
  /** 输出目录 */
  outputDir: string;
  /** 安全输出函数（自动处理文件名 sanitize，默认路径：${outputDir}/test-${blockName}.tsx） */
  safeOutput: SafeOutput;
}

/**
 * 测试模式处理函数类型
 */
export type TestHandler = (context: TestContext) => Promise<void>;

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

