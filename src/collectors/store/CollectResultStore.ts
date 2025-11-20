import path from "node:path";
import fse from "fs-extra";
import { atomicWriteJson } from "../../utils/atomic-write";
import { createI18n, type Locale } from "../../utils/i18n";
import { extractHostname } from "../../config/ConfigManager";
import type { CollectResult } from "../types";

/**
 * 收集结果存储管理器
 *
 * 职责：
 * - 保存收集结果到 collect.json
 * - 从 collect.json 加载收集结果
 */
export class CollectResultStore {
	private collectFile: string;
	private i18n: ReturnType<typeof createI18n>;

	constructor(startUrl: string, stateDir: string, locale?: Locale) {
		this.i18n = createI18n(locale);
		const hostname = extractHostname(startUrl, locale);
		this.collectFile = path.join(stateDir, hostname, "collect.json");
	}

	/**
	 * 加载已保存的收集结果
	 *
	 * @returns 已保存的结果，如果文件不存在则返回 null
	 */
	async load(): Promise<CollectResult | null> {
		if (await fse.pathExists(this.collectFile)) {
			const result = await fse.readJson(this.collectFile);
			console.log(
				`\n${this.i18n.t("collect.loadedFromFile", {
					count: result.totalLinks,
				})}`,
			);
			return result;
		}

		return null;
	}

	/**
	 * 保存收集结果到 collect.json
	 *
	 * @param result - 收集结果
	 */
	async save(result: CollectResult): Promise<void> {
		const outputDir = path.dirname(this.collectFile);
		await fse.ensureDir(outputDir);
		await atomicWriteJson(this.collectFile, result);

		console.log(
			`\n  ${this.i18n.t("collect.saved", { path: this.collectFile })}`,
		);
	}

	/**
	 * 检查 collect.json 是否存在
	 */
	async exists(): Promise<boolean> {
		return await fse.pathExists(this.collectFile);
	}
}
