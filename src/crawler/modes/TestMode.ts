import type { Locator, Page } from "@playwright/test";
import type { InternalConfig } from "../../config/ConfigManager";
import type { BlockHandler, PageHandler } from "../../types";
import { createI18n, type I18n } from "../../utils/i18n";
import type { ProcessingConfig } from "../utils/ConfigHelper";

/**
 * 测试模式
 *
 * 职责：
 * - 导航到测试页面
 * - 执行 page/block handler（不进行并发处理）
 */
export class TestMode {
	private i18n: I18n;

	constructor(
		private config: InternalConfig,
		private page: Page,
	) {
		this.i18n = createI18n(config.locale);
	}

	/**
	 * 执行测试模式
	 */
	async execute(processingConfig: ProcessingConfig): Promise<void> {
		if (!processingConfig.testUrl) {
			throw new Error("测试模式需要提供 testUrl");
		}

		// 导航到测试页面
		await this.navigateToTestPage(
			processingConfig.testUrl,
			processingConfig.waitUntil || "load",
		);

		// 注入脚本警告
		if (
			processingConfig.beforeOpenScripts.length > 0 ||
			processingConfig.afterOpenScripts.length > 0
		) {
			console.warn(this.i18n.t("crawler.testScriptWarning"));
		}

		// 执行 page handler
		if (processingConfig.pageHandler) {
			await this.executePageHandler(
				processingConfig.testUrl,
				processingConfig.pageHandler,
				processingConfig.autoScroll,
			);
		}

		// 执行 block handler
		if (processingConfig.blockHandler && processingConfig.blockLocator) {
			await this.executeBlockHandler(
				processingConfig.blockLocator,
				processingConfig.blockHandler,
			);
		}
	}

	/**
	 * 导航到测试页面
	 */
	private async navigateToTestPage(
		url: string,
		waitUntil: "load" | "domcontentloaded" | "networkidle" | "commit",
	): Promise<void> {
		console.log(`\n${this.i18n.t("crawler.testVisitingUrl", { url })}`);
		await this.page.goto(url, { waitUntil });
		console.log(this.i18n.t("crawler.pageLoaded"));
	}

	/**
	 * 执行 Page Handler
	 */
	private async executePageHandler(
		url: string,
		pageHandler: PageHandler,
		autoScroll?: boolean | { step?: number; interval?: number },
	): Promise<void> {
		const { createClickAndVerify, createClickCode } = await import(
			"../../utils/click-actions"
		);
		const { createSafeOutput } = await import("../../utils/safe-output");
		const { FilenameMappingManager } = await import(
			"../../state/FilenameMapping"
		);

		const outputDir = this.config.outputBaseDir + "/test";
		const mappingManager = new FilenameMappingManager(
			this.config.stateBaseDir,
			this.config.locale,
		);
		await mappingManager.initialize();

		// 执行自动滚动（如果启用）
		if (autoScroll) {
			const { autoScrollToBottom } = await import("../../utils/auto-scroll");
			const scrollConfig = typeof autoScroll === "boolean" ? {} : autoScroll;
			await autoScrollToBottom(this.page, scrollConfig);
		}

		await pageHandler({
			currentPage: this.page,
			currentPath: url,
			outputDir,
			safeOutput: createSafeOutput("test", outputDir, mappingManager),
			clickAndVerify: createClickAndVerify(this.config.locale),
			clickCode: createClickCode(
				this.page,
				createClickAndVerify(this.config.locale),
			),
		});

		await mappingManager.save();
	}

	/**
	 * 执行 Block Handler
	 */
	private async executeBlockHandler(
		blockLocator: string,
		blockHandler: BlockHandler,
	): Promise<void> {
		const { createClickAndVerify, createClickCode } = await import(
			"../../utils/click-actions"
		);
		const { createSafeOutput } = await import("../../utils/safe-output");
		const { FilenameMappingManager } = await import(
			"../../state/FilenameMapping"
		);
		const { BlockNameExtractor } = await import(
			"../../processors/BlockNameExtractor"
		);

		const outputDir = this.config.outputBaseDir + "/test";
		const mappingManager = new FilenameMappingManager(
			this.config.stateBaseDir,
			this.config.locale,
		);
		await mappingManager.initialize();

		// 获取所有 blocks
		const locators = await this.page.locator(blockLocator).all();
		console.log(
			`\n${this.i18n.t("crawler.testFoundBlocks", { count: locators.length })}`,
		);

		// 需要一个临时配置对象来创建 BlockNameExtractor
		// 因为 BlockNameExtractor 需要 blockNameLocator 等配置
		const tempConfig = {
			...this.config,
			blockNameLocator: "role=heading[level=1] >> role=link",
		} as any;

		const nameExtractor = new BlockNameExtractor(tempConfig);

		for (let i = 0; i < locators.length; i++) {
			const locatorItem = locators[i];
			const blockName =
				(await nameExtractor.extract(locatorItem)) || `test-block-${i}`;
			const blockPath = `test/${blockName}`;

			console.log(
				`\n${this.i18n.t("crawler.testProcessingBlock", {
					current: i + 1,
					total: locators.length,
					name: blockName,
				})}`,
			);

			await blockHandler({
				currentPage: this.page,
				block: locatorItem,
				blockPath,
				blockName,
				outputDir,
				safeOutput: createSafeOutput(
					"test",
					outputDir,
					mappingManager,
					undefined,
					blockName,
				),
				clickAndVerify: createClickAndVerify(this.config.locale),
				clickCode: createClickCode(
					locatorItem,
					createClickAndVerify(this.config.locale),
				),
			});
		}

		await mappingManager.save();
	}
}
