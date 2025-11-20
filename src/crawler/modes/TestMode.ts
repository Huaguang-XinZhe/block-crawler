import type { Locator, Page } from "@playwright/test";
import type { InternalConfig } from "../../config/ConfigManager";
import type { BlockHandler, PageHandler } from "../../types";
import type { ProcessingConfig, TestConfig } from "../utils/ConfigHelper";

/**
 * 测试模式
 *
 * 职责：
 * - 导航到测试页面
 * - 定位测试目标
 * - 执行 page/block handler
 */
export class TestMode {
	constructor(
		private config: InternalConfig,
		private page: Page,
	) {}

	/**
	 * 执行测试模式
	 */
	async execute(
		testConfig: TestConfig,
		processingConfig: ProcessingConfig,
	): Promise<void> {
		// 导航到测试页面
		await this.navigateToTestPage(
			testConfig.url,
			processingConfig.waitUntil || "load",
		);

		// 注入脚本警告
		if (
			processingConfig.beforeOpenScripts.length > 0 ||
			processingConfig.afterOpenScripts.length > 0
		) {
			console.warn("测试模式暂不支持脚本注入");
		}

		// 获取定位符
		const locators = await this.getTestLocators(
			testConfig.locator,
			testConfig.options,
		);

		console.log(`\n找到 ${locators.length} 个测试目标`);

		// 执行 page handler
		if (processingConfig.pageHandler) {
			await this.executePageHandler(
				testConfig.url,
				processingConfig.pageHandler,
			);
		}

		// 执行 block handler
		if (processingConfig.blockHandler) {
			await this.executeBlockHandler(
				locators,
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
		await this.page.goto(url, { waitUntil });
	}

	/**
	 * 获取测试定位符
	 */
	private async getTestLocators(
		locator: string,
		options?: { index?: number; name?: string },
	): Promise<Locator[]> {
		let locators = await this.page.locator(locator).all();

		// 如果指定了 index，只取指定索引
		if (options?.index !== undefined) {
			locators = [locators[options.index]];
		}

		// 如果指定了 name，根据名称过滤
		if (options?.name) {
			// TODO: 实现名称过滤逻辑
			console.warn("测试模式的 name 过滤尚未实现");
		}

		return locators;
	}

	/**
	 * 执行 Page Handler
	 */
	private async executePageHandler(
		url: string,
		pageHandler: PageHandler,
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
		locators: Locator[],
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

			console.log(`\n处理测试目标 ${i + 1}/${locators.length}: ${blockName}`);

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

