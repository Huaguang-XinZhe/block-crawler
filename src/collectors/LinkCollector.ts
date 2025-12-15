import type { CollectionLink } from "../types/meta";
import { createI18n } from "../utils/i18n";
import { LinkExtractor } from "./extractors/LinkExtractor";
import { SectionExtractor } from "./extractors/SectionExtractor";
import { CollectResultStore } from "./store/CollectResultStore";
import type { CollectResult, LinkCollectorConfig } from "./types";

/**
 * 链接收集器（配置对象风格）
 *
 * 职责：协调各模块执行收集流程
 *
 * @example
 * const collector = new LinkCollector(page, {
 *   startUrl: 'https://example.com/blocks',
 *   section: { mode: 'static', locator: 'section' },
 *   extraction: { name: 'h3', count: { locator: 'p' } },
 * });
 * const result = await collector.run();
 */
export class LinkCollector {
	private store: CollectResultStore;
	private sectionExtractor: SectionExtractor;
	private linkExtractor: LinkExtractor;
	private i18n: ReturnType<typeof createI18n>;

	constructor(private config: LinkCollectorConfig) {
		this.i18n = createI18n(config.locale);

		// 初始化存储管理器
		this.store = new CollectResultStore(
			config.startUrl,
			config.stateDir || ".crawler",
			config.locale,
		);

		// 初始化 Section 提取器
		this.sectionExtractor = new SectionExtractor(config.page, config.section);

		// 初始化链接提取器
		this.linkExtractor = new LinkExtractor(config.extraction);
	}

	/**
	 * 执行收集流程
	 *
	 * 流程：
	 * 1. 访问起始页面
	 * 2. 判断模式（static 或 tabs）
	 * 3. 提取链接信息
	 * 4. 汇总结果
	 * 5. 保存到 collect.json
	 * 6. 返回结果
	 */
	async run(): Promise<CollectResult> {
		const { startUrl, page, wait, section } = this.config;

		// 1. 访问起始页面
		console.log(`\n${this.i18n.t("collect.start")}\n`);
		console.log(`  ${this.i18n.t("collect.url", { url: startUrl })}`);

		const waitOptions = {
			waitUntil: wait?.waitUntil,
			timeout: wait?.timeout,
		};
		await page.goto(startUrl, waitOptions);
		console.log(`  ${this.i18n.t("collect.loaded")}\n`);

		const collections: CollectionLink[] = [];
		let totalBlocks = 0;

		// 2. 根据模式选择不同的处理流程
		if (section.mode === "tabs") {
			// Tabs 模式：先点击 tab，再提取 section，再提取 links
			const result = await this.runTabsMode();
			collections.push(...result.collections);
			totalBlocks = result.totalBlocks;
		} else {
			// Static 模式：直接提取所有 sections，再循环提取 links
			const result = await this.runStaticMode();
			collections.push(...result.collections);
			totalBlocks = result.totalBlocks;
		}

		// 3. 汇总结果
		const result: CollectResult = {
			lastUpdate: new Date().toLocaleString("zh-CN", {
				timeZone: "Asia/Shanghai",
			}),
			totalLinks: collections.length,
			totalBlocks: totalBlocks,
			collections,
		};

		// 4. 保存到 collect.json
		await this.store.save(result);

		// 5. 返回结果
		console.log(`\n${this.i18n.t("collect.complete")}`);
		console.log(
			`  ${this.i18n.t("collect.totalLinks", { count: result.totalLinks })}`,
		);
		console.log(
			`  ${this.i18n.t("collect.totalBlocks", {
				count: result.totalBlocks,
			})}\n`,
		);

		return result;
	}

	/**
	 * 执行 static 模式的收集
	 */
	private async runStaticMode(): Promise<{
		collections: CollectionLink[];
		totalBlocks: number;
	}> {
		const collections: CollectionLink[] = [];
		let totalBlocks = 0;

		// 提取所有 sections
		const sections = await this.sectionExtractor.extract();
		console.log(
			`  ${this.i18n.t("collect.foundSections", { count: sections.length })}\n`,
		);

		// 循环提取每个 section 的 links
		for (let i = 0; i < sections.length; i++) {
			const section = sections[i];
			console.log(
				`  ${this.i18n.t("collect.processSection", {
					current: i + 1,
					total: sections.length,
				})}`,
			);

			const links = await this.linkExtractor.extract(section);
			console.log(
				`    ${this.i18n.t("collect.foundLinks", { count: links.length })}`,
			);

			for (let j = 0; j < links.length; j++) {
				const linkInfo = links[j];
				console.log(
					`      [${j + 1}/${links.length}] ${linkInfo.link}${
						linkInfo.name ? ` - ${linkInfo.name}` : ""
					}${linkInfo.blockCount ? ` (${linkInfo.blockCount})` : ""}`,
				);

				if (linkInfo.blockCount) {
					totalBlocks += linkInfo.blockCount;
				}

				collections.push(linkInfo);
			}

			console.log("");
		}

		return { collections, totalBlocks };
	}

	/**
	 * 执行 tabs 模式的收集
	 *
	 * 流程：
	 * 1. 获取 tab list 和所有 tabs
	 * 2. 获取所有 section locators（不点击 tab）
	 * 3. 循环每个 tab：
	 *    - 如果不是第一个 tab，点击并等待
	 *    - 提取该 tab 对应的 section 的 links
	 */
	private async runTabsMode(): Promise<{
		collections: CollectionLink[];
		totalBlocks: number;
	}> {
		const { page } = this.config;
		const collections: CollectionLink[] = [];
		let totalBlocks = 0;

		// 1. 获取 tab list
		const tabListLocator = await this.sectionExtractor.getTabList();
		if (!tabListLocator) {
			throw new Error("Failed to get tab list in tabs mode");
		}

		// 2. 获取所有 tabs
		const tabs = await tabListLocator.getByRole("tab").all();
		console.log(
			`  ${this.i18n.t("collect.foundSections", { count: tabs.length })}\n`,
		);

		// 3. 获取所有 section locators（不点击 tab）
		const sections = await this.sectionExtractor.extract();

		// 4. 循环每个 tab
		for (let i = 0; i < tabs.length; i++) {
			const tab = tabs[i];
			const section = sections[i];

			console.log(
				`  ${this.i18n.t("collect.processSection", {
					current: i + 1,
					total: tabs.length,
				})}`,
			);

			// 如果不是第一个 tab，点击并等待
			if (i > 0) {
				await tab.click();
				await page.waitForTimeout(500); // 等待 tab 切换完成
			}

			// 提取该 tab 对应的 section 的 links
			const links = await this.linkExtractor.extract(section);
			console.log(
				`    ${this.i18n.t("collect.foundLinks", { count: links.length })}`,
			);

			for (let j = 0; j < links.length; j++) {
				const linkInfo = links[j];
				console.log(
					`      [${j + 1}/${links.length}] ${linkInfo.link}${
						linkInfo.name ? ` - ${linkInfo.name}` : ""
					}${linkInfo.blockCount ? ` (${linkInfo.blockCount})` : ""}`,
				);

				if (linkInfo.blockCount) {
					totalBlocks += linkInfo.blockCount;
				}

				collections.push(linkInfo);
			}

			console.log("");
		}

		return { collections, totalBlocks };
	}
}
