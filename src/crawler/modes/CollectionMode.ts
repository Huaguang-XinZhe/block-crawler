import type { Page } from "@playwright/test";
import type { CollectResult } from "../../collectors/types";
import type { InternalConfig } from "../../config/ConfigManager";
import { createI18n, type I18n } from "../../utils/i18n";
import type { CollectionConfig } from "../utils/ConfigHelper";
import { ConfigHelper } from "../utils/ConfigHelper";

/**
 * 收集模式
 *
 * 职责：
 * - 执行链接收集
 * - 从 collect.json 加载
 * - 自动查找 collect.json
 */
export class CollectionMode {
	private i18n: I18n;

	constructor(
		private config: InternalConfig,
		private page: Page,
	) {
		this.i18n = createI18n(config.locale);
	}

	/**
	 * 执行收集（包含3种场景）
	 * 1. 配置了 section → 执行新收集
	 * 2. 未配置 section + 配置了 startUrl → 从 collect.json 加载
	 * 3. 未配置 startUrl → 自动查找 collect.json
	 */
	async execute(collectionConfig: CollectionConfig): Promise<CollectResult> {
		const hasSection = ConfigHelper.hasSection(collectionConfig);

		if (!collectionConfig.startUrl) {
			// 场景 3: 未配置 startUrl → 自动查找
			const result = await this.autoLoadCollectResult();
			if (!result) {
				throw new Error(
					"未找到收集数据。请先配置 startUrl() 或确保 collect.json 文件存在。",
				);
			}
			return result;
		}

		if (!hasSection) {
			// 场景 2: 配置了 startUrl 但未配置 section → 从文件加载
			return await this.loadFromFile(collectionConfig.startUrl);
		}

		// 场景 1: 配置了 section → 执行新收集
		return await this.performCollection(collectionConfig);
	}

	/**
	 * 执行新的收集
	 */
	private async performCollection(
		collectionConfig: CollectionConfig,
	): Promise<CollectResult> {
		const { LinkCollector } = await import("../../collectors/LinkCollector");

		const config = ConfigHelper.buildCollectorConfig(
			collectionConfig,
			this.page,
			this.config.locale,
			this.config.stateBaseDir,
		);

		const collector = new LinkCollector(config);
		return await collector.run();
	}

	/**
	 * 从 collect.json 加载已有结果
	 */
	private async loadFromFile(startUrl: string): Promise<CollectResult> {
		const { CollectResultStore } = await import(
			"../../collectors/store/CollectResultStore"
		);
		const store = new CollectResultStore(
			startUrl,
			this.config.stateBaseDir,
			this.config.locale,
		);

		const result = await store.load();
		if (!result) {
			throw new Error(
				`未找到 collect.json 文件。请先配置 section（如 .tabSections() 或 .tabSection()）来执行一次收集。`,
			);
		}

		return result;
	}

	/**
	 * 自动查找并加载 collect.json
	 * 从 stateBaseDir 中查找所有域名目录下的 collect.json
	 */
	private async autoLoadCollectResult(): Promise<CollectResult | null> {
		const fse = await import("fs-extra");
		const path = await import("node:path");

		const stateBaseDir = this.config.stateBaseDir;

		// 检查 stateBaseDir 是否存在
		if (!(await fse.pathExists(stateBaseDir))) {
			return null;
		}

		// 列出所有域名目录
		const entries = await fse.readdir(stateBaseDir, { withFileTypes: true });
		const domainDirs = entries.filter((entry) => entry.isDirectory());

		// 查找第一个包含 collect.json 的目录
		for (const dir of domainDirs) {
			const collectFile = path.join(stateBaseDir, dir.name, "collect.json");
			if (await fse.pathExists(collectFile)) {
				const result = await fse.readJson(collectFile);
				console.log(
					`\n${this.i18n.t("collect.loadedFromFile", {
						count: result.totalLinks,
					})}`,
				);
				console.log(`  文件: ${collectFile}`);
				return result;
			}
		}

		return null;
	}
}

