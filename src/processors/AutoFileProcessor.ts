import type { Locator, Page } from "@playwright/test";
import fse from "fs-extra";
import type { LocatorOrCustom, LocatorsOrCustom } from "../collectors/types";
import type { InternalConfig } from "../config/ConfigManager";
import type {
	BlockAutoConfig,
	CodeExtractor,
	VariantConfig,
} from "../types/handlers";
import { defaultCodeExtractor } from "../utils/default-code-extractor";
import { createI18n, type I18n } from "../utils/i18n";
import { resolveTabName } from "../utils/safe-output";
import type { ProcessingContext } from "./ProcessingContext";

/**
 * 自动文件处理器
 * 职责：自动处理文件 Tab 遍历、代码提取和变种切换
 */
export class AutoFileProcessor {
	private i18n: I18n;
	private extractCode: CodeExtractor;

	constructor(
		private config: InternalConfig,
		private autoConfig: BlockAutoConfig,
		private outputDir: string,
		private blockPath: string,
		private blockName: string,
		private context: ProcessingContext,
	) {
		this.i18n = createI18n(config.locale);
		this.extractCode = autoConfig.extractCode || defaultCodeExtractor;
	}

	/**
	 * 处理 Block 的所有文件和变种
	 */
	async process(block: Locator, currentPage: Page): Promise<void> {
		// 如果配置了变种，遍历所有变种
		if (this.autoConfig.variants && this.autoConfig.variants.length > 0) {
			await this.processWithVariants(block, currentPage);
		} else if (this.autoConfig.fileTabs) {
			// 如果配置了 fileTabs，处理多文件
			await this.processFileTabs(block, currentPage);
		} else {
			// 没有 fileTabs，处理单个文件（输出到 blockName.extension）
			await this.processSingleFile(block);
		}
	}

	/**
	 * 处理带变种的文件
	 */
	private async processWithVariants(
		block: Locator,
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
				if (this.autoConfig.fileTabs) {
					await this.processFileTabs(block, currentPage, variantName);
				}
			}
		}
	}

	/**
	 * 处理单个文件（没有 fileTabs 的场景）
	 * 输出到 blockName.extension（而非 目录/index.extension）
	 */
	private async processSingleFile(block: Locator): Promise<void> {
		// 先滚动 block 到视口顶部，触发懒加载
		await this.scrollToTop(block);

		// 定位 pre 元素
		const preLocator = block.locator("pre");
		const preCount = await preLocator.count();

		// 如果有多个 pre 元素，取最后一个
		const pre = preCount > 1 ? preLocator.last() : preLocator;

		// 提取代码
		const code = await this.extractCode(pre);

		// 没有 fileTabs 时，直接输出到 blockName.tsx
		const fileName = `${this.blockName}.tsx`;

		// 构建输出路径（不再嵌套目录）
		const outputPath = `${this.outputDir}/${this.blockPath}.tsx`;

		// 输出文件
		await fse.outputFile(outputPath, code);
		console.log(`   📝 [${this.blockName}] ${fileName}`);
	}

	/**
	 * 处理文件 Tabs
	 */
	private async processFileTabs(
		block: Locator,
		currentPage: Page,
		variantName?: string,
	): Promise<void> {
		if (!this.autoConfig.fileTabs) return;

		// 先滚动 block 到视口顶部，触发懒加载
		await this.scrollToTop(block);

		// 获取所有文件 Tab
		const fileTabs = await this.resolveLocators(
			this.autoConfig.fileTabs,
			block,
		);

		// 遍历所有文件 Tab
		for (let i = 0; i < fileTabs.length; i++) {
			const fileTab = fileTabs[i];

			// 如果不是第一个，点击切换
			if (i !== 0) {
				await fileTab.click();
			}

			// 获取 Tab 名称
			const tabName = (await fileTab.textContent())?.trim();
			if (!tabName) {
				console.warn("⚠️ tabName is null");
				continue;
			}

			// 智能解析文件名：语言名 → index.ext，文件名 → 直接使用
			const tabResult = resolveTabName(tabName);
			const fileName = tabResult.isFilename
				? tabResult.filename!
				: `index${tabResult.extension}`;

			// 定位 pre 元素
			const pre = block.locator("pre");

			// 提取代码
			const code = await this.extractCode(pre);

			// 构建输出路径
			const outputPath = variantName
				? `${this.outputDir}/${this.blockPath}/${variantName}/${fileName}`
				: `${this.outputDir}/${this.blockPath}/${fileName}`;

			// 输出文件
			await fse.outputFile(outputPath, code);
			console.log(
				`   📝 [${this.blockName}] ${variantName ? `${variantName}/` : ""}${fileName}`,
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
	 * 解析多个定位符
	 */
	private async resolveLocators(
		locatorsOrCustom: LocatorsOrCustom<Locator>,
		parent: Locator,
	): Promise<Locator[]> {
		if (typeof locatorsOrCustom === "string") {
			return await parent.locator(locatorsOrCustom).all();
		}
		return await locatorsOrCustom(parent);
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
