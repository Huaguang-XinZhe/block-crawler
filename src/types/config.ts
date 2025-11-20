import type { Locator, Page } from "@playwright/test";
import type { Locale } from "../utils/i18n";

import type { ProgressConfig } from "./progress";

/**
 * 爬虫配置接口
 */
export interface CrawlerConfig {
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
	/**
	 * 进度恢复配置
	 *
	 * @example
	 * {
	 *   enable: true,
	 *   rebuild: {
	 *     blockType: 'file',
	 *     saveToProgress: true
	 *   }
	 * }
	 */
	progress?: ProgressConfig;

	// ========== 等待配置 ==========
	/**
	 * 访问集合链接后的等待选项
	 * @example { waitUntil: 'networkidle' }
	 */
	collectionLinkWaitOptions?: {
		waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
		timeout?: number;
	};


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
		timing?: "beforePageLoad" | "afterPageLoad";
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
