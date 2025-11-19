import path from "node:path";
import type { Locator, Page } from "@playwright/test";
import fse from "fs-extra";
import { extractHostname } from "../core/ConfigManager";
import { atomicWriteJson } from "../utils/atomic-write";
import { createI18n, type Locale } from "../utils/i18n";

/**
 * 收集结果类型
 */
export interface CollectResult {
	/** 汇总信息 */
	summary: {
		/** 链接总数 */
		totalLinks: number;
		/** Block 总数 */
		totalBlocks: number;
	};
	/** 集合列表 */
	collections: Array<{
		/** 链接地址 */
		link: string;
		/** 集合名称 */
		name?: string;
		/** Block 数量 */
		blockCount?: number;
	}>;
}

/**
 * 定位符或自定义逻辑
 */
export type LocatorOrCustom<T = Locator> =
	| string
	| ((parent: T) => Locator | Promise<Locator>);

/**
 * 提取函数
 */
export type ExtractFunction<T = string | null> = (text: T) => number;

/**
 * 链接收集器链式 API
 * 用于独立运行链接收集阶段
 *
 * @example
 * await new LinkCollectorChain(page)
 *   .collect('https://flyonui.com/blocks')
 *   .wait('load', 3000)
 *   .tabSections('//main/section')
 *   .name('//h3/text()')
 *   .count('p')
 *   .run();
 */
export class LinkCollectorChain {
	private startUrl?: string;
	private tabListConfig?: LocatorOrCustom<Page>;
	private tabSectionConfig?: LocatorOrCustom<Page>;
	private tabSectionsConfig?: ((page: Page) => Promise<Locator[]>) | string;
	private nameConfig?: LocatorOrCustom<Locator>;
	private countConfig?: {
		locator: LocatorOrCustom<Locator>;
		extract?: ExtractFunction;
	};
	private locale: Locale = "zh";
	private stateDir: string = ".crawler";

	constructor(private page: Page) {}

	/**
	 * 设置起始 URL
	 *
	 * @param url 起始 URL
	 * @returns this
	 *
	 * @example
	 * .collect('https://flyonui.com/blocks')
	 */
	collect(url: string): this {
		this.startUrl = url;
		return this;
	}

	/**
	 * 设置等待选项
	 *
	 * @param until 等待类型
	 * @param timeout 超时时间（毫秒）
	 * @returns this
	 *
	 * @example
	 * .wait('load', 3000)
	 */
	wait(
		until?: "load" | "domcontentloaded" | "networkidle" | "commit",
		timeout?: number,
	): this {
		this.waitUntil = until;
		this.waitTimeout = timeout;
		return this;
	}

	/**
	 * 设置 tab list 配置（需要点击 tab 的场景）
	 *
	 * @param locatorOrCustom 定位符或自定义逻辑
	 * @returns this
	 *
	 * @example
	 * .tabList('[role="tablist"]')
	 * .tabList(page => page.getByRole('tablist'))
	 */
	tabList(locatorOrCustom: LocatorOrCustom<Page>): this {
		this.tabListConfig = locatorOrCustom;
		return this;
	}

	/**
	 * 设置 tab section 配置（需要点击 tab 的场景）
	 *
	 * @param locatorOrCustom 定位符或自定义逻辑
	 * @returns this
	 *
	 * @example
	 * .tabSection('section:has(h2:text("{tabText}"))')
	 * .tabSection((page, tabText) => page.getByRole("tabpanel", { name: tabText }))
	 */
	tabSection(locatorOrCustom: LocatorOrCustom<Page>): this {
		this.tabSectionConfig = locatorOrCustom;
		return this;
	}

	/**
	 * 设置 tab sections 配置（不需要点击 tab 的场景）
	 *
	 * @param locatorOrCustom 定位符或自定义逻辑
	 * @returns this
	 *
	 * @example
	 * .tabSections('//main/section')
	 * .tabSections(async (page) => page.locator('section[data-tab-content]').all())
	 */
	tabSections(
		locatorOrCustom: string | ((page: Page) => Promise<Locator[]>),
	): this {
		this.tabSectionsConfig = locatorOrCustom;
		return this;
	}

	/**
	 * 设置名称提取配置
	 *
	 * @param locatorOrCustom 定位符或自定义逻辑
	 * @returns this
	 *
	 * @example
	 * .name('//h3/text()')
	 * .name(link => link.locator('[data-slot="card-title"]'))
	 */
	name(locatorOrCustom: LocatorOrCustom<Locator>): this {
		this.nameConfig = locatorOrCustom;
		return this;
	}

	/**
	 * 设置数量统计配置
	 *
	 * @param locator 定位符或自定义逻辑
	 * @param extract 自定义提取逻辑
	 * @returns this
	 *
	 * @example
	 * .count('p')
	 * .count(link => link.locator('p'), (text) => parseInt(text?.match(/\d+/)?.[0] || '0'))
	 */
	count(locator: LocatorOrCustom<Locator>, extract?: ExtractFunction): this {
		this.countConfig = { locator, extract };
		return this;
	}

	/**
	 * 设置语言
	 *
	 * @param locale 语言
	 * @returns this
	 */
	setLocale(locale: Locale): this {
		this.locale = locale;
		return this;
	}

	/**
	 * 设置状态目录
	 *
	 * @param dir 目录路径
	 * @returns this
	 */
	setStateDir(dir: string): this {
		this.stateDir = dir;
		return this;
	}

	/**
	 * 执行收集
	 */
	async run(): Promise<CollectResult> {
		if (!this.startUrl) {
			throw new Error("必须设置 startUrl（调用 .collect(url)）");
		}

		const i18n = createI18n(this.locale);
		console.log(`\n${i18n.t("collect.start")}\n`);
		console.log(`  ${i18n.t("collect.url", { url: this.startUrl })}`);

		// 访问起始页面
		const waitOptions = {
			waitUntil: this.waitUntil,
			timeout: this.waitTimeout,
		};
		await this.page.goto(this.startUrl, waitOptions);
		console.log(`  ${i18n.t("collect.loaded")}\n`);

		const collections: CollectResult["collections"] = [];
		let totalBlocks = 0;

		// 获取所有 sections
		const sections = await this.getSections();
		console.log(
			`  ${i18n.t("collect.foundSections", { count: sections.length })}\n`,
		);

		// 遍历每个 section
		for (let i = 0; i < sections.length; i++) {
			const section = sections[i];
			console.log(
				`  ${i18n.t("collect.processSection", { current: i + 1, total: sections.length })}`,
			);

			// 获取所有链接
			const links = await section.getByRole("link").all();
			console.log(
				`    ${i18n.t("collect.foundLinks", { count: links.length })}`,
			);

			// 遍历每个链接
			for (let j = 0; j < links.length; j++) {
				const link = links[j];

				// 提取链接地址
				const href = await link.getAttribute("href");
				if (!href) continue;

				// 提取名称（可选）
				let name: string | undefined;
				if (this.nameConfig) {
					const nameLocator = await this.resolveLocator(link, this.nameConfig);
					const nameText = await nameLocator.textContent();
					name = nameText?.trim() || undefined;
				}

				// 提取数量（可选）
				let blockCount: number | undefined;
				if (this.countConfig) {
					const countLocator = await this.resolveLocator(
						link,
						this.countConfig.locator,
					);
					const countText = await countLocator.textContent();
					const count = this.countConfig.extract
						? this.countConfig.extract(countText)
						: this.defaultExtractCount(countText);

					if (count > 0) {
						blockCount = count;
						totalBlocks += count;
					}
				}

				console.log(
					`      [${j + 1}/${links.length}] ${href}${name ? ` - ${name}` : ""}${blockCount ? ` (${blockCount})` : ""}`,
				);

				collections.push({
					link: href,
					name,
					blockCount,
				});
			}

			console.log("");
		}

		// 构建结果
		const result: CollectResult = {
			summary: {
				totalLinks: collections.length,
				totalBlocks: totalBlocks,
			},
			collections,
		};

		// 保存到文件
		await this.saveResult(result);

		console.log(`\n${i18n.t("collect.complete")}`);
		console.log(
			`  ${i18n.t("collect.totalLinks", { count: result.summary.totalLinks })}`,
		);
		console.log(
			`  ${i18n.t("collect.totalBlocks", { count: result.summary.totalBlocks })}\n`,
		);

		return result;
	}

	/**
	 * 获取所有 sections
	 */
	private async getSections(): Promise<Locator[]> {
		// 如果配置了 tabSections，直接获取所有 sections（不需要点击 tab）
		if (this.tabSectionsConfig) {
			if (typeof this.tabSectionsConfig === "string") {
				return this.page.locator(this.tabSectionsConfig).all();
			}
			return this.tabSectionsConfig(this.page);
		}

		// 如果配置了 tabList + tabSection，需要点击 tab
		if (this.tabListConfig && this.tabSectionConfig) {
			const sections: Locator[] = [];

			// 获取 tab list
			const tabList =
				typeof this.tabListConfig === "string"
					? this.page.locator(this.tabListConfig)
					: await this.tabListConfig(this.page);

			// 获取所有 tabs
			const tabs = await tabList.getByRole("tab").all();

			// 遍历每个 tab
			for (const tab of tabs) {
				await tab.click();
				await this.page.waitForTimeout(500); // 等待 tab 切换完成

				// 获取 tab text
				const tabText = await tab.textContent();

				// 获取对应的 section
				let section: Locator;
				if (typeof this.tabSectionConfig === "string") {
					const locatorStr = this.tabSectionConfig.replace(
						"{tabText}",
						tabText || "",
					);
					section = this.page.locator(locatorStr);
				} else {
					section = await this.tabSectionConfig(this.page);
				}

				sections.push(section);
			}

			return sections;
		}

		// 默认：获取页面上的第一个包含链接的区域
		return [this.page.locator("main, body").first()];
	}

	/**
	 * 解析定位符或自定义逻辑
	 */
	private async resolveLocator(
		parent: Locator,
		config: LocatorOrCustom<Locator>,
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
	 * 保存结果到文件
	 */
	private async saveResult(result: CollectResult): Promise<void> {
		if (!this.startUrl) return;

		const i18n = createI18n(this.locale);
		const hostname = extractHostname(this.startUrl, this.locale);
		const outputDir = path.join(this.stateDir, hostname);
		const outputFile = path.join(outputDir, "collect.json");

		await fse.ensureDir(outputDir);
		await atomicWriteJson(outputFile, result);

		console.log(`\n  ${i18n.t("collect.saved", { path: outputFile })}`);
	}
}
