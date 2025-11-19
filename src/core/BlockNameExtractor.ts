import type { Locator } from "@playwright/test";
import { createI18n, type I18n } from "../utils/i18n";
import type { InternalConfig } from "./ConfigManager";

/**
 * Block 名称提取器
 * 职责：统一处理 Block 名称的提取逻辑
 */
export class BlockNameExtractor {
	private i18n: I18n;

	constructor(private config: InternalConfig) {
		this.i18n = createI18n(config.locale);
	}

	/**
	 * 提取 Block 名称
	 *
	 * 优先级：
	 * 1. 配置的 getBlockName 函数
	 * 2. 配置的 blockNameLocator（非默认值）
	 * 3. 默认逻辑：getByRole('heading')
	 *
	 * @throws {Error} 如果结构复杂但未找到 link
	 */
	async extract(block: Locator): Promise<string | null> {
		// 1. 优先使用配置的函数
		if (this.config.getBlockName) {
			return await this.config.getBlockName(block);
		}

		// 2. 如果配置了非默认的 blockNameLocator，使用它
		const defaultLocator = "role=heading[level=1] >> role=link";
		if (this.config.blockNameLocator !== defaultLocator) {
			try {
				return await block.locator(this.config.blockNameLocator).textContent();
			} catch {
				return null;
			}
		}

		// 3. 默认逻辑：使用 getByRole('heading')
		try {
			const heading = block.getByRole("heading").first();
			const count = await heading.count();

			if (count === 0) {
				return null;
			}

			// 获取 heading 内部的所有子元素
			const children = await heading.locator("> *").count();

			// 如果内部子元素 > 1，尝试取 link 文本
			if (children > 1) {
				const link = heading.getByRole("link").first();
				const linkCount = await link.count();

				if (linkCount === 0) {
					throw new Error(this.i18n.t("block.complexHeading"));
				}

				return await link.textContent();
			}

			// 否则直接取 heading 的文本内容
			return await heading.textContent();
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
