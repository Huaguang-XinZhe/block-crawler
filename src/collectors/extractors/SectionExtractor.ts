import type { Locator, Page } from "@playwright/test";
import type { SectionConfig } from "../types";

/**
 * Section 提取器
 *
 * 职责：从页面提取 sections
 *
 * 支持三种模式：
 * 1. static - 静态定位符（字符串或函数）
 * 2. tabs - 需要点击 tab 切换
 * 3. custom - 自定义函数直接返回 Locator[]
 */
export class SectionExtractor {
	constructor(
		private page: Page,
		private config: SectionConfig,
	) {}

	/**
	 * 提取所有 sections
	 */
	async extract(): Promise<Locator[]> {
		switch (this.config.mode) {
			case "static":
				return this.extractStatic();
			case "tabs":
				return this.extractFromTabs();
		}
	}

	/**
	 * 处理静态模式：直接使用定位符获取所有 sections
	 */
	private async extractStatic(): Promise<Locator[]> {
		if (this.config.mode !== "static") {
			throw new Error("Expected static mode");
		}
		const { tabSections } = this.config;

		if (typeof tabSections === "string") {
			return this.page.locator(tabSections).all();
		}

		return tabSections(this.page);
	}

	/**
	 * 处理 tabs 模式：需要点击 tab 并获取对应的 section
	 */
	private async extractFromTabs(): Promise<Locator[]> {
		if (this.config.mode !== "tabs") {
			throw new Error("Expected tabs mode");
		}
		const { tabList, tabSection } = this.config;
		const sections: Locator[] = [];

		// 获取 tab list（如果未提供，使用默认逻辑：页面第一个 role 为 tablist 的元素）
		let tabListLocator: Locator;
		if (tabList) {
			tabListLocator =
				typeof tabList === "string"
					? this.page.locator(tabList)
					: await tabList(this.page);
		} else {
			// 默认逻辑：取页面第一个 role 为 tablist 的元素
			tabListLocator = this.page.getByRole("tablist").first();
		}

		// 获取所有 tabs
		const tabs = await tabListLocator.getByRole("tab").all();

		// 遍历每个 tab
		for (const tab of tabs) {
			await tab.click();
			await this.page.waitForTimeout(500); // 等待 tab 切换完成

			// 获取 tab text
			const tabText = await tab.textContent();

			// 获取对应的 section
			let section: Locator;
			if (typeof tabSection === "string") {
				const locatorStr = tabSection.replace("{tabText}", tabText || "");
				section = this.page.locator(locatorStr);
			} else {
				section = await tabSection(this.page);
			}

			sections.push(section);
		}

		return sections;
	}
}
