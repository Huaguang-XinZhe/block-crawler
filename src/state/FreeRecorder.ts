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
	/** 总 Free 页面数 */
	totalPages: number;
	/** 总 Free Block 数 */
	totalBlocks: number;
	/** Free 页面列表（完整路径） */
	pages: string[];
	/** Free Block 列表（完整路径） */
	blocks: string[];
	/** 按页面分组的 Free Blocks */
	blocksByPage: Record<string, string[]>;
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
	// 按页面分组的 blocks: pagePath -> blockPath[]
	private blocksByPage = new Map<string, Set<string>>();

	constructor(private freeFile: string) {}

	/**
	 * 初始化（加载已有记录）
	 */
	async initialize(): Promise<void> {
		if (await fse.pathExists(this.freeFile)) {
			const record: FreeRecord = await fse.readJson(this.freeFile);
			record.pages.forEach((page) => this.pages.add(page));
			record.blocks.forEach((block) => this.blocks.add(block));

			// 加载 blocksByPage，重建完整的 blockPath
			if (record.blocksByPage) {
				for (const [pagePath, blockNames] of Object.entries(
					record.blocksByPage,
				)) {
					const blockPathSet = new Set<string>();
					for (const blockName of blockNames) {
						// 从 blockName 重建完整的 blockPath
						const blockPath = `${pagePath}/${blockName}`;
						blockPathSet.add(blockPath);
					}
					this.blocksByPage.set(pagePath, blockPathSet);
				}
			}
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
	 * @param blockPath 完整的 block 路径，格式如 "blocks/marketing-ui/hero-section/Hero 1"
	 * @param pagePath 页面路径，格式如 "blocks/marketing-ui/hero-section"
	 */
	addFreeBlock(blockPath: string, pagePath: string): void {
		this.blocks.add(blockPath);

		// 添加到 blocksByPage
		if (!this.blocksByPage.has(pagePath)) {
			this.blocksByPage.set(pagePath, new Set());
		}
		this.blocksByPage.get(pagePath)?.add(blockPath);
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
	isFreeBlock(blockPath: string): boolean {
		return this.blocks.has(blockPath);
	}

	/**
	 * 获取按页面分组的 Free Blocks
	 */
	getBlocksByPage(): Map<string, Set<string>> {
		return this.blocksByPage;
	}

	/**
	 * 获取统计信息
	 */
	getStatistics(): {
		totalPages: number;
		totalBlocks: number;
		pagesWithBlocks: number;
	} {
		return {
			totalPages: this.pages.size,
			totalBlocks: this.blocks.size,
			pagesWithBlocks: this.blocksByPage.size,
		};
	}

	/**
	 * 保存到 free.json
	 */
	async save(): Promise<void> {
		// 转换 blocksByPage 为普通对象，只保留 blockName 避免冗余
		const blocksByPageObj: Record<string, string[]> = {};
		for (const [pagePath, blockPaths] of this.blocksByPage.entries()) {
			// 从 blockPath 中提取 blockName（最后一部分）
			blocksByPageObj[pagePath] = Array.from(blockPaths)
				.map((blockPath) => {
					const parts = blockPath.split("/");
					return parts[parts.length - 1]; // 只保留 blockName
				})
				.sort();
		}

		const record: FreeRecord = {
			lastUpdate: new Date().toLocaleString("zh-CN", {
				timeZone: "Asia/Shanghai",
			}),
			totalPages: this.pages.size,
			totalBlocks: this.blocks.size,
			pages: Array.from(this.pages).sort(),
			blocks: Array.from(this.blocks).sort(),
			blocksByPage: blocksByPageObj,
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
			// 转换 blocksByPage 为普通对象，只保留 blockName 避免冗余
			const blocksByPageObj: Record<string, string[]> = {};
			for (const [pagePath, blockPaths] of this.blocksByPage.entries()) {
				// 从 blockPath 中提取 blockName（最后一部分）
				blocksByPageObj[pagePath] = Array.from(blockPaths)
					.map((blockPath) => {
						const parts = blockPath.split("/");
						return parts[parts.length - 1]; // 只保留 blockName
					})
					.sort();
			}

			const record: FreeRecord = {
				lastUpdate: new Date().toLocaleString("zh-CN", {
					timeZone: "Asia/Shanghai",
				}),
				totalPages: this.pages.size,
				totalBlocks: this.blocks.size,
				pages: Array.from(this.pages).sort(),
				blocks: Array.from(this.blocks).sort(),
				blocksByPage: blocksByPageObj,
			};

			atomicWriteJsonSync(this.freeFile, record);
		} catch (error) {
			console.error(
				`❌ ${error instanceof Error ? error.message : String(error)}`,
			);
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
