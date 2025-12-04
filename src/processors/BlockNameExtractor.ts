import type { Locator } from "@playwright/test";
import type { InternalConfig } from "../config/ConfigManager";
import type { ExtendedExecutionConfig } from "../executors/ExecutionContext";
import { createI18n, type I18n } from "../utils/i18n";

/**
 * Block 名称提取器
 * 职责：统一处理 Block 名称的提取逻辑
 */
export class BlockNameExtractor {
	private i18n: I18n;

	constructor(
		private config: InternalConfig,
		private extendedConfig: ExtendedExecutionConfig = {},
	) {
		this.i18n = createI18n(config.locale);
	}

	/**
	 * 提取 Block 名称
	 *
	 * 优先级：
	 * 1. 配置的 getBlockName 函数
	 * 2. 配置的 blockNameLocator（非默认值）
	 * 3. 默认逻辑：在浏览器上下文中智能提取
	 *
	 * @throws {Error} 如果结构复杂但未找到 link
	 */
	async extract(block: Locator): Promise<string | null> {
		// 1. 优先使用配置的函数
		if (this.extendedConfig.getBlockName) {
			return await this.extendedConfig.getBlockName(block);
		}

		// 2. 如果配置了非默认的 blockNameLocator，使用它
		const defaultLocator = "role=heading[level=1] >> role=link";
		const blockNameLocator =
			this.extendedConfig.blockNameLocator || defaultLocator;
		if (blockNameLocator !== defaultLocator) {
			try {
				return await block.locator(blockNameLocator).textContent();
			} catch {
				return null;
			}
		}

		// 3. 默认逻辑：使用 evaluate 在浏览器上下文中执行，减少调试日志
		try {
			const result = await block.evaluate((el) => {
				// 找到第一个 heading 元素
				const heading = el.querySelector("h1, h2, h3, h4, h5, h6");
				if (!heading) {
					return { success: false, name: null, error: null };
				}

				// 获取 heading 内部的所有元素子节点
				const children = Array.from(heading.children);

				// 如果内部子元素 > 1，尝试取 link 文本
				if (children.length > 1) {
					const link = heading.querySelector("a");
					if (!link) {
						return {
							success: false,
							name: null,
							error: "complexHeading",
						};
					}
					return {
						success: true,
						name: link.textContent?.trim() || null,
						error: null,
					};
				}

				// 否则直接取 heading 的文本内容
				return {
					success: true,
					name: heading.textContent?.trim() || null,
					error: null,
				};
			});

			if (result.error === "complexHeading") {
				throw new Error(this.i18n.t("block.complexHeading"));
			}

			return result.name;
		} catch (error) {
			if (
				error instanceof Error &&
				error.message.includes("heading 内部结构复杂")
			) {
				throw error;
			}
			return null;
		}
	}
}
