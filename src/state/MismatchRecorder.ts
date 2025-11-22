import path from "node:path";
import fse from "fs-extra";
import { atomicWriteJson, atomicWriteJsonSync } from "../utils/atomic-write";

/**
 * 组件数不一致记录项
 */
export interface MismatchItem {
	/** 页面路径 */
	pagePath: string;
	/** 预期的组件数（来自 collect.json） */
	expectedCount: number;
	/** 实际定位到的组件数 */
	actualCount: number;
	/** 记录时间 */
	timestamp: string;
}

/**
 * 组件数不一致记录文件结构
 */
export interface MismatchRecord {
	/** 最后更新时间 */
	lastUpdate: string;
	/** 不一致的页面总数 */
	total: number;
	/** 不一致的页面列表 */
	mismatches: MismatchItem[];
}

/**
 * 组件数不一致记录器
 * 用于记录页面组件数与预期不符的情况（可能是滚动加载不完全）
 */
export class MismatchRecorder {
	private mismatches: Map<string, MismatchItem> = new Map();
	private mismatchFile: string;

	constructor(stateDir: string, domain: string) {
		this.mismatchFile = path.join(stateDir, domain, "mismatch.json");
		this.load();
	}

	/**
	 * 加载已记录的不一致信息
	 */
	private load(): void {
		if (fse.pathExistsSync(this.mismatchFile)) {
			try {
				const record: MismatchRecord = fse.readJsonSync(this.mismatchFile);
				for (const item of record.mismatches) {
					this.mismatches.set(item.pagePath, item);
				}
			} catch {
				// 读取失败，忽略
			}
		}
	}

	/**
	 * 添加一条不一致记录
	 */
	addMismatch(
		pagePath: string,
		expectedCount: number,
		actualCount: number,
	): void {
		this.mismatches.set(pagePath, {
			pagePath,
			expectedCount,
			actualCount,
			timestamp: new Date().toLocaleString("zh-CN", {
				timeZone: "Asia/Shanghai",
			}),
		});
	}

	/**
	 * 检查页面是否在不一致列表中
	 */
	hasMismatch(pagePath: string): boolean {
		return this.mismatches.has(pagePath);
	}

	/**
	 * 获取不一致记录数量
	 */
	getMismatchCount(): number {
		return this.mismatches.size;
	}

	/**
	 * 异步保存到文件
	 */
	async save(): Promise<void> {
		const mismatches = Array.from(this.mismatches.values()).sort((a, b) =>
			a.pagePath.localeCompare(b.pagePath),
		);

		const record: MismatchRecord = {
			lastUpdate: new Date().toLocaleString("zh-CN", {
				timeZone: "Asia/Shanghai",
			}),
			total: mismatches.length,
			mismatches,
		};

		const outputDir = path.dirname(this.mismatchFile);
		await fse.ensureDir(outputDir);
		await atomicWriteJson(this.mismatchFile, record);
	}

	/**
	 * 同步保存到文件（用于进程退出时）
	 */
	saveSync(): void {
		const mismatches = Array.from(this.mismatches.values()).sort((a, b) =>
			a.pagePath.localeCompare(b.pagePath),
		);

		const record: MismatchRecord = {
			lastUpdate: new Date().toLocaleString("zh-CN", {
				timeZone: "Asia/Shanghai",
			}),
			total: mismatches.length,
			mismatches,
		};

		const outputDir = path.dirname(this.mismatchFile);
		fse.ensureDirSync(outputDir);
		atomicWriteJsonSync(this.mismatchFile, record);
	}
}
