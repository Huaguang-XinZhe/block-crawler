import path from "node:path";
import fse from "fs-extra";
import { atomicWriteJson } from "../utils/atomic-write";
import { createI18n, type Locale } from "../utils/i18n";

/**
 * 文件名映射接口
 */
export interface FilenameMapping {
	/** sanitize 后的文件名 -> 原始文件名 */
	[sanitized: string]: string;
}

/**
 * 文件名映射管理器
 * 用于记录 sanitize 前后的文件名对应关系
 */
export class FilenameMappingManager {
	private mapping: FilenameMapping = {};
	private mappingFile: string;
	private isDirty: boolean = false;
	private i18n: ReturnType<typeof createI18n>;

	constructor(stateDir: string, locale?: Locale) {
		this.mappingFile = path.join(stateDir, "filename-mapping.json");
		this.i18n = createI18n(locale);
	}

	/**
	 * 初始化：从文件加载现有映射
	 */
	async initialize(): Promise<void> {
		if (await fse.pathExists(this.mappingFile)) {
			try {
				this.mapping = await fse.readJson(this.mappingFile);
			} catch (error) {
				console.warn(
					this.i18n.t("filename.loadFailed", { path: this.mappingFile }),
					error,
				);
				this.mapping = {};
			}
		}
	}

	/**
	 * 记录文件名映射
	 * 只有当原始文件名和 sanitize 后的文件名不同时才记录
	 *
	 * @param original 原始文件名
	 * @param sanitized sanitize 后的文件名
	 */
	record(original: string, sanitized: string): void {
		// 只有当文件名发生变化时才记录
		if (original !== sanitized) {
			this.mapping[sanitized] = original;
			this.isDirty = true;
		}
	}

	/**
	 * 从 sanitize 后的文件名获取原始文件名
	 *
	 * @param sanitized sanitize 后的文件名
	 * @returns 原始文件名，如果未找到则返回 sanitized
	 */
	getOriginal(sanitized: string): string {
		return this.mapping[sanitized] || sanitized;
	}

	/**
	 * 获取所有映射
	 */
	getAllMappings(): FilenameMapping {
		return { ...this.mapping };
	}

	/**
	 * 保存映射到文件
	 */
	async save(): Promise<void> {
		if (!this.isDirty) {
			return;
		}

		try {
			await atomicWriteJson(this.mappingFile, this.mapping);
			this.isDirty = false;
		} catch (error) {
			console.error(
				this.i18n.t("filename.saveFailed", { path: this.mappingFile }),
				error,
			);
			throw error;
		}
	}

	/**
	 * 从文件加载映射（静态方法，用于外部读取）
	 *
	 * @param stateDir 状态目录（包含域名子目录）
	 * @param locale 语言配置（可选）
	 * @returns 文件名映射，如果文件不存在则返回空对象
	 */
	static async load(
		stateDir: string,
		locale?: Locale,
	): Promise<FilenameMapping> {
		const mappingFile = path.join(stateDir, "filename-mapping.json");
		const i18n = createI18n(locale);

		if (await fse.pathExists(mappingFile)) {
			try {
				return await fse.readJson(mappingFile);
			} catch (error) {
				console.warn(
					i18n.t("filename.loadFailed", { path: mappingFile }),
					error,
				);
				return {};
			}
		}

		return {};
	}

	/**
	 * 从 sanitize 后的文件名获取原始文件名（静态方法，用于外部查询）
	 *
	 * @param stateDir 状态目录（包含域名子目录）
	 * @param sanitized sanitize 后的文件名
	 * @param locale 语言配置（可选）
	 * @returns 原始文件名，如果未找到则返回 sanitized
	 */
	static async findOriginal(
		stateDir: string,
		sanitized: string,
		locale?: Locale,
	): Promise<string> {
		const mapping = await FilenameMappingManager.load(stateDir, locale);
		return mapping[sanitized] || sanitized;
	}
}
