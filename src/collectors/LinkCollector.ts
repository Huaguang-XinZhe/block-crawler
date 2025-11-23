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
	 * 2. 提取 sections
	 * 3. 提取链接信息
	 * 4. 汇总结果
	 * 5. 保存到 collect.json
	 * 6. 返回结果
	 */
	async run(): Promise<CollectResult> {
		const { startUrl, page, wait } = this.config;

		// 1. 访问起始页面
		console.log(`\n${this.i18n.t("collect.start")}\n`);
		console.log(`  ${this.i18n.t("collect.url", { url: startUrl })}`);

		const waitOptions = {
			waitUntil: wait?.waitUntil,
			timeout: wait?.timeout,
		};
		await page.goto(startUrl, waitOptions);
		console.log(`  ${this.i18n.t("collect.loaded")}\n`);

		// 2. 提取 sections
		const sections = await this.sectionExtractor.extract();
		console.log(
			`  ${this.i18n.t("collect.foundSections", { count: sections.length })}\n`,
		);

		// 3. 提取链接信息
		const collections: CollectionLink[] = [];
		let totalBlocks = 0;

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

		// 4. 汇总结果
		const result: CollectResult = {
			lastUpdate: new Date().toLocaleString("zh-CN", {
				timeZone: "Asia/Shanghai",
			}),
			totalLinks: collections.length,
			totalBlocks: totalBlocks,
			collections,
		};

		// 5. 保存到 collect.json
		await this.store.save(result);

		// 6. 返回结果
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
}
