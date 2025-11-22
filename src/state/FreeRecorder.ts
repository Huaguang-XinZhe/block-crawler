import path from "node:path";
import fse from "fs-extra";
import { atomicWriteJson, atomicWriteJsonSync } from "../utils/atomic-write";

/**
 * Free 项目类型
 */
export interface FreeItem {
	/** 名称（页面链接或 Block 名称） */
	name: string;
	/** 类型 */
	type: "page" | "block";
}

/**
 * Free 记录数据结构
 */
export interface FreeRecord {
	/** 最后更新时间 */
	lastUpdate: string;
	/** Free 页面列表 */
	pages: string[];
	/** Free Block 列表 */
	blocks: string[];
}

/**
 * Free 记录器
 *
 * 职责：
 * - 记录 Free 页面和 Block
 * - 保存到 free.json
 * - 加载已有记录
 */
export class FreeRecorder {
	private pages = new Set<string>();
	private blocks = new Set<string>();

	constructor(private freeFile: string) {}

	/**
	 * 初始化（加载已有记录）
	 */
	async initialize(): Promise<void> {
		if (await fse.pathExists(this.freeFile)) {
			const record: FreeRecord = await fse.readJson(this.freeFile);
			record.pages.forEach((page) => this.pages.add(page));
			record.blocks.forEach((block) => this.blocks.add(block));
		}
	}

	/**
	 * 添加 Free 页面
	 */
	addFreePage(pagePath: string): void {
		this.pages.add(pagePath);
	}

	/**
	 * 添加 Free Block
	 */
	addFreeBlock(blockName: string): void {
		this.blocks.add(blockName);
	}

	/**
	 * 获取所有 Free 页面
	 */
	getFreePages(): string[] {
		return Array.from(this.pages);
	}

	/**
	 * 获取所有 Free Block
	 */
	getFreeBlocks(): string[] {
		return Array.from(this.blocks);
	}

	/**
	 * 检查是否为 Free 页面
	 */
	isFreePage(pagePath: string): boolean {
		return this.pages.has(pagePath);
	}

	/**
	 * 检查是否为 Free Block
	 */
	isFreeBlock(blockName: string): boolean {
		return this.blocks.has(blockName);
	}

	/**
	 * 保存到 free.json
	 */
	async save(): Promise<void> {
		const record: FreeRecord = {
			lastUpdate: new Date().toLocaleString("zh-CN", {
				timeZone: "Asia/Shanghai",
			}),
			pages: Array.from(this.pages).sort(),
			blocks: Array.from(this.blocks).sort(),
		};

		const outputDir = path.dirname(this.freeFile);
		await fse.ensureDir(outputDir);
		await atomicWriteJson(this.freeFile, record);
	}

	/**
	 * 同步保存到 free.json（用于信号处理等紧急场景）
	 */
	saveSync(): void {
		try {
			const record: FreeRecord = {
				lastUpdate: new Date().toLocaleString("zh-CN", {
					timeZone: "Asia/Shanghai",
				}),
				pages: Array.from(this.pages).sort(),
				blocks: Array.from(this.blocks).sort(),
			};

			atomicWriteJsonSync(this.freeFile, record);
		} catch (error) {
			console.error("同步保存 Free 记录失败:", error);
		}
	}

	/**
	 * 静态方法：从文件加载 Free 页面列表
	 */
	static async loadFreePages(freeFile: string): Promise<string[]> {
		if (await fse.pathExists(freeFile)) {
			const record: FreeRecord = await fse.readJson(freeFile);
			return record.pages;
		}
		return [];
	}

	/**
	 * 静态方法：从文件加载 Free Block 列表
	 */
	static async loadFreeBlocks(freeFile: string): Promise<string[]> {
		if (await fse.pathExists(freeFile)) {
			const record: FreeRecord = await fse.readJson(freeFile);
			return record.blocks;
		}
		return [];
	}
}
