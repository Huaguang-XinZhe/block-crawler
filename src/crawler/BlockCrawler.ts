import type { Locator, Page } from "@playwright/test";
import type {
	CollectResult,
	CountExtractFunction,
	LocatorOrCustom,
	LocatorsOrCustom,
	NameExtractFunction,
} from "../collectors/types";
import {
	createInternalConfig,
	type InternalConfig,
} from "../config/ConfigManager";
import type { BlockHandler, CrawlerConfig, PageHandler } from "../types";
import { createI18n, type I18n } from "../utils/i18n";
import { CollectionMode } from "./modes/CollectionMode";
import { ProcessingMode } from "./modes/ProcessingMode";
import { TestMode } from "./modes/TestMode";
import type {
	CollectionConfig,
	ProcessingConfig,
	TestConfig,
} from "./utils/ConfigHelper";

/**
 * Block 爬虫 (Facade Pattern)
 *
 * 职责：
 * 1. 提供用户友好的链式 API
 * 2. 协调收集和处理阶段
 * 3. 委托给各个 Mode 执行
 *
 * @example
 * // 完整流程：收集 + 处理
 * const crawler = new BlockCrawler(page, {
 *   startUrl: 'https://example.com'
 * });
 * await crawler
 *   .collect('networkidle')
 *   .tabSections('section')
 *   .name('h3')
 *   .count('p', (text) => parseInt(text))
 *   .open('networkidle')
 *   .page(async ({ page }) => { ... })
 *   .block('[data-preview]', async ({ block }) => { ... })
 *   .run();
 *
 * // 只收集（注释掉 open 和处理器）
 * await crawler
 *   .collect()
 *   .tabSections('section')
 *   .name('h3')
 *   .run();
 *
 * // 只处理（使用已有的 collect.json，注释掉 tabSections）
 * await crawler
 *   .open('networkidle')
 *   .page(async ({ page }) => { ... })
 *   .run();
 *
 * // 自动查找 collect.json
 * await crawler
 *   .open('networkidle')
 *   .page(async ({ page }) => { ... })
 *   .run();
 *
 * // 测试模式
 * await crawler
 *   .open('load')
 *   .test('https://example.com/page', 'section', { index: 0 })
 *   .run();
 */
export class BlockCrawler {
	private config: InternalConfig;
	private i18n: I18n;

	// 收集阶段配置
	private collectionConfig: CollectionConfig = {};

	// 处理阶段配置
	private processingConfig: ProcessingConfig = {
		beforeOpenScripts: [],
		afterOpenScripts: [],
	};

	// 测试配置
	private testConfig?: TestConfig;

	// 认证配置
	private authHandler?: (page: Page) => Promise<void>;

	// 标记
	private isOpenCalled = false;

	// Mode 实例（懒加载）
	private collectionMode?: CollectionMode;
	private processingMode?: ProcessingMode;
	private testMode?: TestMode;

	constructor(
		private _page: Page,
		config?: CrawlerConfig,
	) {
		this.config = createInternalConfig(config || {});
		this.i18n = createI18n(this.config.locale);
		// 将全局配置的 startUrl 设置到收集配置
		if (config?.startUrl) {
			this.collectionConfig.startUrl = config.startUrl;
		}
	}

	// ==================== 配置阶段 API ====================

	/**
	 * 配置认证处理器（自动管理登录状态）
	 *
	 * 支持三种用法：
	 * 1. 传入登录 URL 字符串（自动处理）
	 * 2. 传入配置对象（自动处理 + 可选 redirectUrl）
	 * 3. 传入自定义处理函数（完全控制）
	 *
	 * 如果 `.crawler/域名/auth.json` 不存在，会执行登录并保存状态；
	 * 如果存在，会自动复用已有的认证状态。
	 *
	 * **自动登录要求：**
	 * - 登录页必须恰好有 2 个 textbox（email + password）
	 * - 必须有 1 个包含 "sign in" 的 button
	 * - 凭据配置在 `.env` 文件中（格式：`{DOMAIN}_EMAIL` 和 `{DOMAIN}_PASSWORD`）
	 *
	 * **自定义登录要求：**
	 * - 登录处理函数必须等待登录完成（如等待跳转），否则 cookies 可能还未设置就保存了空状态
	 *
	 * @example
	 * ```typescript
	 * // 用法 1: 只传登录 URL（最简单）
	 * .auth("https://example.com/login")
	 *
	 * // 用法 2: 配置对象（指定跳转 URL）
	 * .auth({
	 *   loginUrl: "https://example.com/login",
	 *   redirectUrl: "https://example.com/*"
	 * })
	 *
	 * // 用法 3: 自定义处理（复杂场景）
	 * .auth(async (page) => {
	 *   await page.goto('https://example.com/login');
	 *   await page.fill('#username', 'user');
	 *   await page.fill('#password', 'pass');
	 *   await page.click('button[type=submit]');
	 *   // 必须等待登录完成！
	 *   await page.waitForURL('**' + '/dashboard');
	 * })
	 * ```
	 */
	// 存储 auth 配置（延迟创建 handler，因为需要 stateDir）
	private authConfig:
		| string
		| { loginUrl: string; redirectUrl?: string }
		| ((page: Page) => Promise<void>)
		| null = null;

	auth(loginUrl: string): this;
	auth(options: { loginUrl: string; redirectUrl?: string }): this;
	auth(handler: (page: Page) => Promise<void>): this;
	auth(
		handlerOrUrlOrOptions:
			| string
			| { loginUrl: string; redirectUrl?: string }
			| ((page: Page) => Promise<void>),
	): this {
		// 保存配置，延迟到 run 时创建 handler（需要 stateDir）
		this.authConfig = handlerOrUrlOrOptions;
		return this;
	}

	/**
	 * 开始收集阶段配置，设置等待选项
	 * @param waitUntil 页面等待状态
	 * @param timeout 超时时间（可选）
	 */
	collect(
		waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit",
		timeout?: number,
	): this {
		this.collectionConfig.collectWaitUntil = waitUntil;
		this.collectionConfig.collectWaitTimeout = timeout;
		return this;
	}

	/**
	 * 设置 tab list 配置（需要点击 tab 的场景）
	 */
	tabList(locatorOrCustom: LocatorOrCustom<Page>): this {
		this.collectionConfig.tabListConfig = locatorOrCustom;
		return this;
	}

	/**
	 * 设置 tab section 配置（需要点击 tab 的场景）
	 */
	tabSection(locatorOrCustom: LocatorOrCustom<Page>): this {
		this.collectionConfig.tabSectionConfig = locatorOrCustom;
		return this;
	}

	/**
	 * 设置 tab sections 配置（不需要点击 tab 的场景）
	 */
	tabSections(locatorsOrCustom: LocatorsOrCustom<Page>): this {
		this.collectionConfig.tabSectionsConfig = locatorsOrCustom;
		return this;
	}

	/**
	 * 设置名称提取配置
	 */
	name(locator: LocatorOrCustom<Locator>, extract?: NameExtractFunction): this {
		this.collectionConfig.nameConfig = { locator, extract };
		return this;
	}

	/**
	 * 设置数量统计配置
	 */
	count(
		locator: LocatorOrCustom<Locator>,
		extract?: CountExtractFunction,
	): this {
		this.collectionConfig.countConfig = { locator, extract };
		return this;
	}

	/**
	 * 注入脚本（可在 open 前后调用）
	 */
	inject(scripts: string[]): this {
		if (this.isOpenCalled) {
			// open() 之后调用 → afterPageLoad
			this.processingConfig.afterOpenScripts.push(...scripts);
		} else {
			// open() 之前调用 → beforePageLoad
			this.processingConfig.beforeOpenScripts.push(...scripts);
		}
		return this;
	}

	/**
	 * 打开页面并等待（必须调用）
	 */
	open(
		waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit",
	): this {
		this.isOpenCalled = true;
		this.processingConfig.waitUntil = waitUntil;
		return this;
	}

	/**
	 * 设置页面级处理器（在整个页面执行）
	 */
	page(handler: PageHandler): this {
		this.processingConfig.pageHandler = handler;
		this.processingConfig.skipFreeMode = "page";
		return this;
	}

	/**
	 * 跳过 Free 页面或 Block
	 */
	skipFree(text: string): this {
		if (!this.processingConfig.skipFreeMode) {
			throw new Error("skipFree() 必须在 page() 或 block() 之后调用");
		}
		this.processingConfig.skipFreeText = text;
		return this;
	}

	/**
	 * 设置 Block 级处理器（在单个 block 执行）
	 */
	block(sectionLocator: string, handler: BlockHandler): this {
		this.processingConfig.blockLocator = sectionLocator;
		this.processingConfig.blockHandler = handler;
		this.processingConfig.skipFreeMode = "block";
		return this;
	}

	/**
	 * 测试模式（直接定位到具体组件）
	 */
	test(
		url: string,
		locator: string,
		options?: { index?: number; name?: string },
	): this {
		this.testConfig = { url, locator, options };
		return this;
	}

	// ==================== 执行阶段 ====================

	/**
	 * 执行爬虫任务（必须调用）
	 */
	async run(): Promise<void> {
		// 测试模式：直接执行测试
		if (this.testConfig) {
			// 测试模式必须调用 open()
			if (!this.isOpenCalled) {
				throw new Error("测试模式必须调用 open() 方法");
			}
			await this.getTestMode().execute(this.testConfig, this.processingConfig);
			return;
		}

		// 正常模式：必须配置收集阶段或处理器
		if (
			!this.collectionConfig.startUrl &&
			!this.processingConfig.pageHandler &&
			!this.processingConfig.blockHandler
		) {
			throw new Error("必须配置收集阶段或处理器（page/block）");
		}

		// 处理模式需要调用 open()
		if (
			(this.processingConfig.pageHandler ||
				this.processingConfig.blockHandler) &&
			!this.isOpenCalled
		) {
			throw new Error("处理模式必须调用 open() 方法");
		}

		// 步骤 0: 处理认证（如果配置了 authConfig）
		if (this.authConfig && this.collectionConfig.startUrl) {
			const { generatePathsForUrl } = await import("../config/ConfigManager");
			const paths = generatePathsForUrl(
				this.config,
				this.collectionConfig.startUrl,
			);

			// 根据 authConfig 创建最终的 authHandler
			let finalAuthHandler: ((page: Page) => Promise<void>) | undefined;

			if (typeof this.authConfig === "function") {
				// 用法 3: 自定义处理函数
				finalAuthHandler = this.authConfig;
			} else {
				// 用法 1 & 2: 自动登录
				const { createAutoAuthHandler } = await import(
					"../auth/AutoAuthHandler"
				);
				const options =
					typeof this.authConfig === "string"
						? { loginUrl: this.authConfig }
						: this.authConfig;

				finalAuthHandler = createAutoAuthHandler(
					options,
					paths.stateDir,
					this.config.locale,
				);
			}

			const { AuthManager } = await import("../auth/AuthManager");
			const authManager = new AuthManager(
				this._page,
				paths.stateDir,
				finalAuthHandler,
				this.config.locale,
			);
			await authManager.ensureAuth();
		}

		// 步骤 1: 执行收集阶段或加载数据
		let collectResult: CollectResult | undefined;
		if (
			this.collectionConfig.startUrl ||
			this.processingConfig.pageHandler ||
			this.processingConfig.blockHandler
		) {
			collectResult = await this.getCollectionMode().execute(
				this.collectionConfig,
			);
		}

		// 步骤 2: 执行处理阶段（如果配置了处理器）
		if (
			this.processingConfig.pageHandler ||
			this.processingConfig.blockHandler
		) {
			if (!collectResult) {
				throw new Error(
					"未找到收集数据。请先配置 startUrl() 或确保 collect.json 文件存在。",
				);
			}
			await this.getProcessingMode().execute(
				collectResult,
				this.processingConfig,
			);
		}
	}

	// ==================== Mode 懒加载 ====================

	private getCollectionMode(): CollectionMode {
		if (!this.collectionMode) {
			this.collectionMode = new CollectionMode(this.config, this._page);
		}
		return this.collectionMode;
	}

	private getProcessingMode(): ProcessingMode {
		if (!this.processingMode) {
			this.processingMode = new ProcessingMode(this.config, this._page);
		}
		return this.processingMode;
	}

	private getTestMode(): TestMode {
		if (!this.testMode) {
			this.testMode = new TestMode(this.config, this._page);
		}
		return this.testMode;
	}

	// ==================== Getters ====================

	get outputBaseDir(): string {
		return this.config.outputBaseDir;
	}

	get stateBaseDir(): string {
		return this.config.stateBaseDir;
	}
}
