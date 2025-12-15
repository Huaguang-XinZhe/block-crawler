import path from "node:path";
import type { Locator, Page } from "@playwright/test";
import fse from "fs-extra";
import type { LocatorOrCustom } from "../collectors/types";
import type { InternalConfig } from "../config/ConfigManager";
import type {
	BlockAutoConfig,
	CodeExtractor,
	ConditionalBlockConfig,
} from "../types/handlers";
import { defaultCodeExtractor } from "../utils/default-code-extractor";
import { createI18n, type I18n } from "../utils/i18n";
import { resolveTabName } from "../utils/safe-output";
import type { ProcessingContext } from "./ProcessingContext";

/**
 * 条件配置匹配的超时时间（毫秒）
 */
const CONDITION_MATCH_TIMEOUT = 100;

/**
 * 自动文件处理器
 * 职责：自动处理文件 Tab 遍历、代码提取和变种切换
 */
export class AutoFileProcessor {
	private i18n: I18n;
	private extractCode: CodeExtractor;
	private effectiveOutputDir: string;

	constructor(
		private config: InternalConfig,
		private autoConfig: BlockAutoConfig,
		private outputDir: string,
		private blockPath: string,
		private blockName: string,
		private context: ProcessingContext,
		private codeRegion?: Locator,
	) {
		this.i18n = createI18n(config.locale);
		this.extractCode = autoConfig.extractCode || defaultCodeExtractor;
		// 如果配置了 outputSubdir，则使用子目录
		this.effectiveOutputDir = autoConfig.outputSubdir
			? path.join(outputDir, autoConfig.outputSubdir)
			: outputDir;
	}

	/**
	 * 根据条件配置快速匹配合适的配置
	 *
	 * @param block Block 元素
	 * @param conditionalConfigs 条件配置数组
	 * @returns 匹配的配置或 undefined
	 */
	static async matchConditionalConfig(
		block: Locator,
		conditionalConfigs: ConditionalBlockConfig[],
	): Promise<
		| {
				config: BlockAutoConfig;
				whenLocator: Locator;
				codeRegion?: Locator;
				skipPreChecks?: boolean;
		  }
		| undefined
	> {
		for (const conditionalConfig of conditionalConfigs) {
			try {
				// 获取条件 Locator
				const conditionLocator = conditionalConfig.when(block);

				// 使用短超时快速判断是否可见
				const isVisible = await conditionLocator.isVisible({
					timeout: CONDITION_MATCH_TIMEOUT,
				});

				if (isVisible) {
					// 匹配成功，返回配置和 whenLocator（用于点击）
					const codeRegionLocator = conditionalConfig.codeRegion
						? conditionalConfig.codeRegion(block)
						: undefined;

					return {
						config: conditionalConfig.config,
						whenLocator: conditionLocator,
						codeRegion: codeRegionLocator,
						skipPreChecks: conditionalConfig.skipPreChecks,
					};
				}
			} catch {
				// 超时或其他错误，继续尝试下一个配置
				continue;
			}
		}

		// 没有匹配的配置
		return undefined;
	}

	/**
	 * 处理 Block 的所有文件和变种
	 */
	async process(block: Locator, currentPage: Page): Promise<void> {
		// 使用 codeRegion 或 block 作为代码提取范围
		const region = this.codeRegion || block;

		// 如果配置了变种，遍历所有变种
		if (this.autoConfig.variants && this.autoConfig.variants.length > 0) {
			await this.processWithVariants(block, region, currentPage);
		} else if (this.autoConfig.tabContainer) {
			// 如果配置了 tabContainer，处理多文件
			await this.processFileTabs(block, region, currentPage);
		} else {
			// 没有 tabContainer，处理单个文件（输出到 blockName.extension）
			await this.processSingleFile(block, region);
		}
	}

	/**
	 * 处理带变种的文件
	 * @param block 用于滚动和定位按钮
	 * @param region 代码提取区域（可能是 codeRegion 或 block）
	 * @param currentPage 当前页面
	 */
	private async processWithVariants(
		block: Locator,
		region: Locator,
		currentPage: Page,
	): Promise<void> {
		const variants = this.autoConfig.variants!;

		for (let variantIndex = 0; variantIndex < variants.length; variantIndex++) {
			const variantConfig = variants[variantIndex];
			const cacheKey = `variant-${variantIndex}`;

			// 检查是否有完整的 nameMapping
			const hasCompleteMapping =
				variantConfig.nameMapping &&
				Object.keys(variantConfig.nameMapping).length > 0;

			let variantNames: string[];

			if (hasCompleteMapping) {
				// 如果配置了完整的 nameMapping，直接使用它的值
				variantNames = Object.values(variantConfig.nameMapping!);
			} else {
				// 尝试从缓存获取变种名称
				const cached = this.context.getVariantNames(cacheKey);
				if (cached) {
					variantNames = cached;
				} else {
					// 第一次处理：获取所有变种名称
					const button = await this.resolveLocator(
						variantConfig.buttonLocator,
						block,
					);
					await button.click();

					const options = currentPage.getByRole("option");
					const count = await options.count();

					const optionTexts: string[] = [];
					for (let i = 0; i < count; i++) {
						const text = (await options.nth(i).textContent())?.trim() || "";
						optionTexts.push(text);
					}

					variantNames = optionTexts;
					// 缓存变种名称
					this.context.setVariantNames(cacheKey, variantNames);

					// 关闭菜单（点击第一个选项，因为它本来就是选中的）
					await options.nth(0).click();
				}
			}

			// 处理每个变种
			for (let i = 0; i < variantNames.length; i++) {
				const variantName = variantNames[i];

				// 如果不是第一个选项，需要点击切换
				if (i !== 0) {
					const button = await this.resolveLocator(
						variantConfig.buttonLocator,
						block,
					);
					await button.click();

					const options = currentPage.getByRole("option");
					await options.nth(i).click();
					// 等待切换完成
					await currentPage.waitForTimeout(variantConfig.waitTime ?? 500);
				}

				// 处理该变种下的所有文件
				if (this.autoConfig.tabContainer) {
					await this.processFileTabs(block, region, currentPage, variantName);
				}
			}
		}
	}

	/**
	 * 处理单个文件（没有 tabContainer 的场景）
	 * 输出到 blockName.extension（而非 目录/index.extension）
	 * @param block 用于滚动
	 * @param region 代码提取区域（可能是 codeRegion 或 block）
	 */
	private async processSingleFile(
		block: Locator,
		region: Locator,
	): Promise<void> {
		// 先滚动 block 到视口顶部，触发懒加载
		await this.scrollToTop(block);

		// 在 region 中定位 pre 元素
		// 默认取最后一个（页面上常见同时存在复制用 pre + 展示用 pre）
		const pre = region.locator("pre").last();

		// 提取代码
		const code = await this.extractCode(pre);

		// 没有 tabContainer 时，直接输出到 blockName.tsx
		const fileName = `${this.blockName}.tsx`;

		// 构建输出路径（使用 effectiveOutputDir，不再嵌套目录）
		const outputPath = `${this.effectiveOutputDir}/${this.blockPath}.tsx`;

		// 输出文件
		await fse.outputFile(outputPath, code);
		// 日志格式：有 blockName 显示 [blockName]，没有则省略
		const blockLabel = this.blockName ? `[${this.blockName}] ` : "";
		console.log(`   📝 ${blockLabel}${fileName}`);
	}

	/**
	 * 处理文件 Tabs
	 * @param block 用于滚动
	 * @param region 代码提取区域（用于获取 tabContainer）
	 * @param currentPage 当前页面
	 * @param variantName 变种名称（可选）
	 */
	private async processFileTabs(
		block: Locator,
		region: Locator,
		currentPage: Page,
		variantName?: string,
	): Promise<void> {
		if (!this.autoConfig.tabContainer) return;

		// 先滚动 block 到视口顶部，触发懒加载
		await this.scrollToTop(block);

		// 从容器中获取所有文件 Tab（自动调用 getByRole(tabRole)）
		const container = this.autoConfig.tabContainer(region);
		const tabRole = this.autoConfig.tabRole || "tab";
		const fileTabs = await container.getByRole(tabRole).all();

		// 遍历所有文件 Tab
		for (let i = 0; i < fileTabs.length; i++) {
			const fileTab = fileTabs[i];

			// 如果不是第一个，点击切换
			if (i !== 0) {
				await fileTab.click();
			}

			// 获取 Tab 名称（支持路径格式，如 "base/text-editor/text-editor.tsx"）
			const tabName = (await fileTab.textContent())?.trim();
			if (!tabName) {
				console.warn("⚠️ tabName is null");
				continue;
			}

			// 智能解析：如果是路径格式或文件名，直接使用；如果是语言名，转为 index.ext
			const tabResult = resolveTabName(tabName);
			// 路径格式或文件名直接使用原始 tabName，语言名转为 index.ext
			const filePath = tabResult.isFilename
				? tabName // 直接使用原始路径/文件名
				: `index${tabResult.extension}`;

			// 在 region 中定位 pre 元素（默认取最后一个，避免 strict mode violation）
			const pre = region.locator("pre").last();

			// 提取代码
			const code = await this.extractCode(pre);

			// 构建输出路径（使用 effectiveOutputDir，直接复用 tab 名称作为路径）
			const outputPath = variantName
				? `${this.effectiveOutputDir}/${variantName}/${filePath}`
				: `${this.effectiveOutputDir}/${filePath}`;

			// 输出文件
			await fse.outputFile(outputPath, code);
			// 日志格式：有 blockName 显示 [blockName]，没有则省略
			const blockLabel = this.blockName ? `[${this.blockName}] ` : "";
			console.log(
				`   📝 ${blockLabel}${variantName ? `${variantName}/` : ""}${filePath}`,
			);
		}
	}

	/**
	 * 解析单个定位符
	 */
	private async resolveLocator(
		locatorOrCustom: LocatorOrCustom<Locator>,
		parent: Locator,
	): Promise<Locator> {
		if (typeof locatorOrCustom === "string") {
			return parent.locator(locatorOrCustom);
		}
		return await locatorOrCustom(parent);
	}

	/**
	 * 滚动元素到视口顶部
	 * 用于触发懒加载：将 block 滚动到顶部，确保 pre 区域进入视口
	 */
	private async scrollToTop(element: Locator): Promise<void> {
		await element.evaluate((el) => {
			el.scrollIntoView({ block: "start", behavior: "instant" });
		});
		// // 等待懒加载完成
		// await element.page().waitForTimeout(200);
	}
}
