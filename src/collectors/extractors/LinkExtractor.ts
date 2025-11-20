import type { Locator } from "@playwright/test";
import type { CollectionLink } from "../../types/meta";
import type { ExtractionConfig } from "../types";

/**
 * 链接提取器
 *
 * 职责：从 section 中提取链接信息
 *
 * 提取内容：
 * - href（必需）
 * - name（可选）
 * - blockCount（可选）
 */
export class LinkExtractor {
	constructor(private config?: ExtractionConfig) {}

	/**
	 * 从 section 提取所有链接
	 */
	async extract(section: Locator): Promise<CollectionLink[]> {
		const links = await section.getByRole("link").all();
		const result: CollectionLink[] = [];

		for (const link of links) {
			// 提取链接地址
			const href = await link.getAttribute("href");
			if (!href) continue;

			// 提取名称（可选）
			const name = await this.extractName(link);

			// 提取数量（可选）
			const blockCount = await this.extractCount(link);

			result.push({
				link: href,
				name,
				blockCount,
			});
		}

		return result;
	}

	/**
	 * 提取名称
	 */
	private async extractName(link: Locator): Promise<string | undefined> {
		if (!this.config?.name) {
			return undefined;
		}

		const nameLocator = await this.resolveLocator(
			link,
			this.config.name.locator,
		);

		const name = this.config.name.extract
			? await this.config.name.extract(nameLocator)
			: await this.defaultExtractName(nameLocator);

		return name || undefined;
	}

	/**
	 * 提取数量
	 */
	private async extractCount(link: Locator): Promise<number | undefined> {
		if (!this.config?.count) {
			return undefined;
		}

		const countLocator = await this.resolveLocator(
			link,
			this.config.count.locator,
		);
		const countText = await countLocator.textContent();

		const count = this.config.count.extract
			? this.config.count.extract(countText)
			: this.defaultExtractCount(countText);

		return count > 0 ? count : undefined;
	}

	/**
	 * 解析定位符或自定义逻辑
	 */
	private async resolveLocator(
		parent: Locator,
		config: string | ((parent: Locator) => Locator | Promise<Locator>),
	): Promise<Locator> {
		if (typeof config === "string") {
			return parent.locator(config);
		}
		return config(parent);
	}

	/**
	 * 默认提取数量逻辑
	 */
	private defaultExtractCount(text: string | null): number {
		const matches = text?.match(/\d+/g);
		return matches
			? matches.reduce((sum, num) => sum + parseInt(num, 10), 0)
			: 0;
	}

	/**
	 * 默认提取名称逻辑（智能提取第一个文本节点）
	 */
	private async defaultExtractName(locator: Locator): Promise<string> {
		return locator.evaluate((el) => {
			// 如果元素内有多个子节点，尝试找到第一个非空文本节点
			const textNode = Array.from(el.childNodes).find(
				(n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim() !== "",
			);

			// 如果找到文本节点，返回其内容；否则返回整个元素的 textContent
			return textNode?.textContent?.trim() || el.textContent?.trim() || "";
		});
	}
}
