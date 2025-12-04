import path from "node:path";
import type { CrawlerConfig } from "../types/config";
import { createI18n, type Locale } from "../utils/i18n";

/**
 * 内部配置接口（完全解析后的配置）
 *
 * 说明：
 * - 收集相关配置由 LinkCollector 负责
 * - 处理相关配置由 ExecutionOrchestrator 负责
 * - 此接口仅包含全局共享配置
 */
export interface InternalConfig {
	locale: Locale;
	outputBaseDir: string;
	stateBaseDir: string;
	maxConcurrency: number;
	pauseOnError: boolean;
	logLevel: "info" | "debug" | "silent";
	ignoreMismatch: boolean;
	progress: {
		enable: boolean;
		rebuild?: import("../types/progress").ProgressRebuildConfig;
	};
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
	domain: string;
	outputDir: string;
	stateDir: string;
	progressFile: string;
	freeFile: string;
	collectFile: string;
	authFile: string;
} {
	const hostname = extractHostname(url, baseConfig.locale);
	const outputDir = path.join(baseConfig.outputBaseDir, hostname);
	const stateDir = path.join(baseConfig.stateBaseDir, hostname);
	const progressFile = path.join(stateDir, "progress.json");
	const freeFile = path.join(stateDir, "free.json");
	const collectFile = path.join(stateDir, "collect.json");
	const authFile = path.join(stateDir, "auth.json");

	return {
		hostname,
		domain: hostname, // domain 和 hostname 相同
		outputDir,
		stateDir,
		progressFile,
		freeFile,
		collectFile,
		authFile,
	};
}

/**
 * 创建内部配置（仅全局共享配置）
 */
export function createInternalConfig(config: CrawlerConfig): InternalConfig {
	return {
		locale: config.locale || "zh",
		outputBaseDir: config.outputDir || "output",
		stateBaseDir: config.stateDir || ".crawler",
		maxConcurrency: config.maxConcurrency || 5,
		pauseOnError: config.pauseOnError ?? true,
		logLevel: config.logLevel || "info",
		ignoreMismatch: config.ignoreMismatch ?? false,
		progress: {
			enable: config.progress?.enable ?? false,
			rebuild: config.progress?.rebuild,
		},
	};
}
