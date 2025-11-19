import path from "node:path";
import type { CrawlerConfig } from "../types/config";
import { createI18n, type Locale } from "../utils/i18n";

/**
 * 内部配置接口（完全解析后的配置）
 *
 * 移除了收集相关配置（由 CollectPhase 负责）：
 * - startUrl
 * - startUrlWaitOptions
 * - collectionNameLocator
 * - collectionCountLocator
 */
export interface InternalConfig
	extends Required<
		Omit<
			CrawlerConfig,
			| "tabListAriaLabel"
			| "tabSectionLocator"
			| "getTabSection"
			| "getAllTabSections"
			| "extractTabTextFromSection"
			| "getAllBlocks"
			| "getBlockName"
			| "extractBlockCount"
			| "outputDir"
			| "stateDir"
			| "blockNameLocator"
			| "collectionLinkWaitOptions"
			| "skipFree"
			| "locale"
			| "scriptInjection"
			| "pauseOnError"
			| "useIndependentContext"
			| "progress"
		>
	> {
	locale: Locale;
	pauseOnError: boolean;
	useIndependentContext: boolean;
	progress: {
		enable: boolean;
		rebuild?: import("../types/progress").ProgressRebuildConfig;
	};
	tabListAriaLabel?: string;
	tabSectionLocator?: string;
	getTabSection?: CrawlerConfig["getTabSection"];
	getAllTabSections?: CrawlerConfig["getAllTabSections"];
	extractTabTextFromSection?: CrawlerConfig["extractTabTextFromSection"];
	getAllBlocks?: CrawlerConfig["getAllBlocks"];
	getBlockName?: CrawlerConfig["getBlockName"];
	extractBlockCount?: CrawlerConfig["extractBlockCount"];
	skipFree?: CrawlerConfig["skipFree"];
	scriptInjection?: CrawlerConfig["scriptInjection"];
	outputBaseDir: string;
	stateBaseDir: string;
	blockNameLocator: string;
	collectionLinkWaitOptions?: CrawlerConfig["collectionLinkWaitOptions"];
}

/**
 * 从 URL 提取域名
 */
export function extractHostname(url: string, locale?: Locale): string {
	try {
		const urlObj = new URL(url);
		return urlObj.hostname;
	} catch {
		const i18n = createI18n(locale);
		console.warn(i18n.t("config.parseUrlFailed"));
		return "default";
	}
}

/**
 * 根据 URL 生成完整路径配置
 */
export function generatePathsForUrl(
	baseConfig: InternalConfig,
	url: string,
): {
	hostname: string;
	outputDir: string;
	stateDir: string;
	progressFile: string;
	metaFile: string;
	collectFile: string;
} {
	const hostname = extractHostname(url, baseConfig.locale);
	const outputDir = path.join(baseConfig.outputBaseDir, hostname);
	const stateDir = path.join(baseConfig.stateBaseDir, hostname);
	const progressFile = path.join(stateDir, "progress.json");
	const metaFile = path.join(stateDir, "meta.json");
	const collectFile = path.join(stateDir, "collect.json");

	return {
		hostname,
		outputDir,
		stateDir,
		progressFile,
		metaFile,
		collectFile,
	};
}

/**
 * 创建内部配置
 */
export function createInternalConfig(config: CrawlerConfig): InternalConfig {
	return {
		locale: config.locale || "zh",
		maxConcurrency: config.maxConcurrency || 5,
		outputBaseDir: config.outputDir || "output",
		stateBaseDir: config.stateDir || ".crawler",
		blockNameLocator:
			config.blockNameLocator || "role=heading[level=1] >> role=link",
		pauseOnError: config.pauseOnError ?? true,
		useIndependentContext: config.useIndependentContext ?? false,
		progress: {
			enable: config.progress?.enable ?? true,
			rebuild: config.progress?.rebuild,
		},

		// 可选配置
		tabListAriaLabel: config.tabListAriaLabel,
		tabSectionLocator: config.tabSectionLocator,
		getTabSection: config.getTabSection,
		getAllTabSections: config.getAllTabSections,
		extractTabTextFromSection: config.extractTabTextFromSection,
		getAllBlocks: config.getAllBlocks,
		getBlockName: config.getBlockName,
		extractBlockCount: config.extractBlockCount,
		collectionLinkWaitOptions: config.collectionLinkWaitOptions,
		skipFree: config.skipFree,
		scriptInjection: config.scriptInjection,
	};
}
