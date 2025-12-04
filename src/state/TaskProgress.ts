import path from "node:path";
import fse from "fs-extra";
import type { ProgressConfig } from "../types";
import { atomicWriteJson, atomicWriteJsonSync } from "../utils/atomic-write";
import { createI18n, type I18n, type Locale } from "../utils/i18n";

/**
 * 任务进度管理器
 * 用于记录爬取进度，支持中断恢复
 * 同时跟踪 block 级别和 page 级别的完成状态
 */
export class TaskProgress {
	private progressFile: string;
	private outputDir: string;
	private collectFile: string;
	private completedBlocks: Set<string>;
	private completedPages: Set<string>;
	private isDirty: boolean = false;
	private i18n: I18n;
	private progressConfig: Required<ProgressConfig>;

	constructor(
		progressFile: string = "progress.json",
		outputDir: string = "output",
		stateDir: string = ".crawler",
		locale?: Locale,
		progressConfig?: ProgressConfig,
	) {
		this.progressFile = progressFile;
		this.outputDir = outputDir;
		this.collectFile = path.join(path.dirname(progressFile), "collect.json");
		// stateDir 参数保留用于未来扩展，当前未使用
		this.completedBlocks = new Set();
		this.completedPages = new Set();
		this.i18n = createI18n(locale);
		this.progressConfig = {
			enable: progressConfig?.enable ?? true,
			rebuild: {
				saveToProgress: progressConfig?.rebuild?.saveToProgress ?? true,
				checkBlockComplete: progressConfig?.rebuild?.checkBlockComplete,
			},
		};
	}

	/**
	 * 初始化：加载或重建进度
	 */
	async initialize(): Promise<void> {
		// 如果未开启进度恢复，直接返回
		if (!this.progressConfig.enable) {
			console.log(this.i18n.t("progress.disabled"));
			return;
		}

		// 先检查 progress.json
		if (await fse.pathExists(this.progressFile)) {
			console.log(this.i18n.t("progress.found"));
			await this.loadProgress();
			console.log(
				this.i18n.t("progress.loaded", {
					blocks: this.completedBlocks.size,
					pages: this.completedPages.size,
				}),
			);
		} else {
			// progress.json 不存在，重建进度
			console.log(this.i18n.t("progress.scanning"));
			await this.rebuildProgress();
			console.log(
				this.i18n.t("progress.rebuilt", {
					blocks: this.completedBlocks.size,
					pages: this.completedPages.size,
				}),
			);
		}
	}

	/**
	 * 从文件加载进度
	 */
	private async loadProgress(): Promise<void> {
		try {
			const data = await fse.readJson(this.progressFile);
			this.completedBlocks = new Set(data.completedBlocks || []);
			this.completedPages = new Set(data.completedPages || []);
		} catch (error) {
			console.warn(this.i18n.t("progress.loadFailed"), error);
			await this.rebuildProgress();
		}
	}

	/**
	 * 重建进度：从 outputDir 扫描已有文件
	 *
	 * 重建逻辑：
	 * 1. 优先从 collect.json 读取页面列表（如果存在）
	 * 2. 自动检测 block 类型（file 或 directory）
	 * 3. 对于每个页面，扫描其下的 block（文件或目录）
	 * 4. 使用自定义或默认的检查函数判断 block 是否完成
	 * 5. 如果没有 collect.json，则回退到扫描 outputDir 动态判断
	 * 6. 在内存中标记已完成的 blocks 和 pages
	 * 7. 根据 saveToProgress 配置决定是否保存到 progress.json
	 */
	private async rebuildProgress(): Promise<void> {
		if (!(await fse.pathExists(this.outputDir))) {
			return;
		}

		const completedBlocks: string[] = [];
		const pageBlocksMap = new Map<
			string,
			{ total: number; completed: number }
		>();

		// 优先从 collect.json 读取页面列表
		const pageLinks = await this.loadPageLinksFromCollect();

		if (pageLinks.length > 0) {
			// 使用 collect.json 的页面列表
			await this.scanPagesFromCollect(
				pageLinks,
				pageBlocksMap,
				completedBlocks,
			);
		} else {
			// 回退到扫描 outputDir
			await this.scanOutputDir(
				this.outputDir,
				"",
				pageBlocksMap,
				completedBlocks,
			);
		}

		this.completedBlocks = new Set(completedBlocks);

		// 检查哪些页面已完全完成（默认假设页面完整）
		const completedPages: string[] = [];

		for (const [pagePath, stats] of pageBlocksMap.entries()) {
			// 只要页面有 block 就标记为已完成（快速恢复）
			if (stats.total > 0) {
				completedPages.push(pagePath);
			}
		}
		this.completedPages = new Set(completedPages);

		// 根据配置决定是否保存到文件
		const saveToFile = this.progressConfig.rebuild.saveToProgress;
		if (
			saveToFile &&
			(completedBlocks.length > 0 || completedPages.length > 0)
		) {
			await this.saveProgress();
		}
	}

	/**
	 * 从 collect.json 加载页面链接列表
	 */
	private async loadPageLinksFromCollect(): Promise<string[]> {
		try {
			if (!(await fse.pathExists(this.collectFile))) {
				return [];
			}

			const data = await fse.readJson(this.collectFile);
			if (!data.collections || !Array.isArray(data.collections)) {
				return [];
			}

			// 提取所有链接并标准化（去掉开头的 /）
			const links = data.collections.map((item: { link: string }) => {
				const link = item.link;
				return link.startsWith("/") ? link.slice(1) : link;
			});

			console.log(
				this.i18n.t("progress.collectLoaded", { count: links.length }),
			);
			return links;
		} catch {
			return [];
		}
	}

	/**
	 * 根据 collect.json 的页面列表扫描 blocks
	 */
	private async scanPagesFromCollect(
		pageLinks: string[],
		pageBlocksMap: Map<string, { total: number; completed: number }>,
		completedBlocks: string[],
	): Promise<void> {
		// 自动检测 blockType
		let blockType: "file" | "directory" = "file"; // 默认值
		if (pageLinks.length > 0) {
			const detectedType = await this.detectBlockType(pageLinks);
			if (detectedType) {
				blockType = detectedType;
				console.log(
					this.i18n.t("progress.detectedBlockType", { type: blockType }),
				);
			}
		}

		let skippedCount = 0;
		for (const pagePath of pageLinks) {
			const fullPagePath = path.join(this.outputDir, pagePath);

			if (!(await fse.pathExists(fullPagePath))) {
				skippedCount++;
				continue;
			}

			const pageStats = { total: 0, completed: 0 };
			pageBlocksMap.set(pagePath, pageStats);

			const entries = await fse.readdir(fullPagePath, {
				withFileTypes: true,
			});

			if (blockType === "file") {
				// block 是文件
				const files = entries.filter((e) => e.isFile());
				const componentFiles = files.filter((f) =>
					this.isComponentFile(f.name),
				);

				for (const file of componentFiles) {
					// blockPath 不包含扩展名（与 BlockProcessor 标记时一致）
					const blockName = path.parse(file.name).name;
					const blockPath = path.join(pagePath, blockName).replace(/\\/g, "/");
					pageStats.total++;

					const isComplete = await this.checkBlockComplete(
						blockPath,
						blockType,
					);
					if (isComplete) {
						completedBlocks.push(blockPath);
						pageStats.completed++;
					}
				}
			} else {
				// block 是目录
				const dirs = entries.filter((e) => e.isDirectory());

				for (const dir of dirs) {
					const blockPath = path.join(pagePath, dir.name).replace(/\\/g, "/");
					pageStats.total++;

					const isComplete = await this.checkBlockComplete(
						blockPath,
						blockType,
					);
					if (isComplete) {
						completedBlocks.push(blockPath);
						pageStats.completed++;
					}
				}
			}
		}

		if (skippedCount > 0) {
			console.log(
				`⚠️  跳过了 ${skippedCount} 个不存在的页面目录（共 ${pageLinks.length} 个）`,
			);
		}

		console.log(
			this.i18n.t("progress.scanComplete", {
				pages: pageBlocksMap.size,
				blocks: completedBlocks.length,
			}),
		);
	}

	/**
	 * 自动检测 blockType（通过检查第一个有内容的页面目录）
	 */
	private async detectBlockType(
		pageLinks: string[],
	): Promise<"file" | "directory" | null> {
		// 检查前 5 个页面，找到第一个有内容的
		const samplesToCheck = Math.min(5, pageLinks.length);

		for (let i = 0; i < samplesToCheck; i++) {
			const pagePath = pageLinks[i];
			const fullPagePath = path.join(this.outputDir, pagePath);

			if (!(await fse.pathExists(fullPagePath))) {
				continue;
			}

			try {
				const entries = await fse.readdir(fullPagePath, {
					withFileTypes: true,
				});

				const files = entries.filter((e) => e.isFile());
				const dirs = entries.filter((e) => e.isDirectory());

				// 如果有组件文件，说明是 file 模式
				const componentFiles = files.filter((f) =>
					this.isComponentFile(f.name),
				);
				if (componentFiles.length > 0) {
					return "file";
				}

				// 如果有子目录，说明可能是 directory 模式
				// 进一步检查子目录内是否有组件文件
				if (dirs.length > 0) {
					for (const dir of dirs) {
						const subDirPath = path.join(fullPagePath, dir.name);
						const hasContent = await this.hasContentInDirectory(subDirPath);
						if (hasContent) {
							return "directory";
						}
					}
				}
			} catch {
				// 读取失败，跳过
				continue;
			}
		}

		return null;
	}

	/**
	 * 检查文件是否是常见的组件文件
	 */
	private isComponentFile(filename: string): boolean {
		const componentExtensions = [
			".tsx",
			".ts",
			".jsx",
			".js",
			".vue",
			".svelte",
			".html", // 添加 HTML
			".css", // 添加 CSS
		];
		return componentExtensions.some((ext) => filename.endsWith(ext));
	}

	/**
	 * 扫描输出目录，识别页面和 block（fallback 方法）
	 *
	 * 策略：
	 * - 如果目录下直接有组件文件，说明这是"页面目录"，文件就是 block
	 * - 如果目录下有子目录且子目录内有组件文件，说明这是"页面目录"，子目录就是 block
	 * - 否则继续向下递归
	 */
	private async scanOutputDir(
		baseDir: string,
		relativePath: string,
		pageBlocksMap: Map<string, { total: number; completed: number }>,
		completedBlocks: string[],
	): Promise<void> {
		const fullPath = path.join(baseDir, relativePath);

		if (!(await fse.pathExists(fullPath))) {
			return;
		}

		const entries = await fse.readdir(fullPath, { withFileTypes: true });

		// 检查当前目录的内容
		const files = entries.filter((e) => e.isFile());
		const dirs = entries.filter((e) => e.isDirectory());
		const componentFiles = files.filter((f) => this.isComponentFile(f.name));

		// 动态判断 blockType 和是否是页面目录
		let isPageDir = false;
		let blockType: "file" | "directory" | null = null;

		if (componentFiles.length > 0) {
			// 当前目录直接有组件文件 → 这是页面目录，block 是文件
			isPageDir = true;
			blockType = "file";
		} else {
			// 检查子目录：
			// - 如果子目录直接有组件文件 → 子目录是页面目录，继续递归
			// - 如果子目录没有直接组件文件但有更深层的 → 当前是页面目录，block 是目录
			let hasSubDirWithDirectFiles = false;
			let hasSubDirWithDeepFiles = false;

			for (const dir of dirs) {
				const subDirPath = path.join(fullPath, dir.name);
				const hasDirectFiles =
					await this.hasDirectComponentFiles(subDirPath);
				if (hasDirectFiles) {
					// 子目录直接有组件文件，它自己是页面目录
					hasSubDirWithDirectFiles = true;
				} else {
					// 检查子目录是否有更深层的组件文件
					const hasDeepFiles =
						await this.hasContentInDirectory(subDirPath);
					if (hasDeepFiles) {
						hasSubDirWithDeepFiles = true;
					}
				}
			}

			if (hasSubDirWithDeepFiles && !hasSubDirWithDirectFiles) {
				// 只有深层文件，当前是页面目录（directory 模式）
				isPageDir = true;
				blockType = "directory";
			}
			// 如果 hasSubDirWithDirectFiles，继续递归（不设置 isPageDir）
		}

		if (isPageDir && blockType) {
			// 这是一个页面目录，处理其下的 block
			const pagePath = relativePath;
			const pageStats = { total: 0, completed: 0 };
			pageBlocksMap.set(pagePath, pageStats);

			if (blockType === "file") {
				// block 是文件
				for (const file of componentFiles) {
					// blockPath 不包含扩展名（与 BlockProcessor 标记时一致）
					const blockName = path.parse(file.name).name;
					const blockPath = path
						.join(relativePath, blockName)
						.replace(/\\/g, "/");
					pageStats.total++;

					const isComplete = await this.checkBlockComplete(
						blockPath,
						blockType,
					);
					if (isComplete) {
						completedBlocks.push(blockPath);
						pageStats.completed++;
					}
				}
			} else {
				// block 是目录
				for (const dir of dirs) {
					const blockPath = path
						.join(relativePath, dir.name)
						.replace(/\\/g, "/");
					pageStats.total++;

					const isComplete = await this.checkBlockComplete(
						blockPath,
						blockType,
					);
					if (isComplete) {
						completedBlocks.push(blockPath);
						pageStats.completed++;
					}
				}
			}
			// 重要：找到页面目录后，不再向下递归！
			// 这样可以避免把 block 目录也当作页面目录
			return;
		} else {
			// 不是页面目录，继续向下递归
			for (const dir of dirs) {
				const newRelativePath = path
					.join(relativePath, dir.name)
					.replace(/\\/g, "/");
				await this.scanOutputDir(
					baseDir,
					newRelativePath,
					pageBlocksMap,
					completedBlocks,
				);
			}
		}
	}

	/**
	 * 检查目录下是否有内容（递归查找组件文件）
	 */
	private async hasContentInDirectory(dirPath: string): Promise<boolean> {
		try {
			const entries = await fse.readdir(dirPath, { withFileTypes: true });

			// 检查当前层级
			for (const entry of entries) {
				if (entry.isFile() && this.isComponentFile(entry.name)) {
					return true;
				}
			}

			// 递归检查子目录
			for (const entry of entries) {
				if (entry.isDirectory()) {
					const subPath = path.join(dirPath, entry.name);
					if (await this.hasContentInDirectory(subPath)) {
						return true;
					}
				}
			}

			return false;
		} catch {
			return false;
		}
	}

	/**
	 * 检查目录内第一层是否直接有组件文件（不递归）
	 */
	private async hasDirectComponentFiles(dirPath: string): Promise<boolean> {
		try {
			const entries = await fse.readdir(dirPath, { withFileTypes: true });
			return entries.some(
				(e) => e.isFile() && this.isComponentFile(e.name),
			);
		} catch {
			return false;
		}
	}

	/**
	 * 检查 block 是否已完成
	 *
	 * 使用自定义检查函数（如果提供），否则使用默认逻辑：
	 * - file 模式：检查是否存在带任意组件扩展名的文件（blockPath 不含扩展名）
	 * - directory 模式：检查目录下是否有组件文件
	 *
	 * @param blockPath block 路径（相对于 outputDir，file 模式下不含扩展名）
	 * @param blockType block 类型（file 或 directory）
	 */
	private async checkBlockComplete(
		blockPath: string,
		blockType: "file" | "directory",
	): Promise<boolean> {
		// 如果提供了自定义检查函数，使用它
		if (this.progressConfig.rebuild.checkBlockComplete) {
			return await this.progressConfig.rebuild.checkBlockComplete(
				blockPath,
				this.outputDir,
			);
		}

		// 否则使用默认逻辑
		const blockFullPath = path.join(this.outputDir, blockPath);

		if (blockType === "file") {
			// block 是文件（blockPath 不含扩展名），检查是否存在带任意组件扩展名的文件
			const componentExtensions = [
				".tsx",
				".ts",
				".jsx",
				".js",
				".vue",
				".svelte",
				".html",
				".css",
			];
			for (const ext of componentExtensions) {
				if (await fse.pathExists(blockFullPath + ext)) {
					return true;
				}
			}
			return false;
		} else {
			// block 是目录，检查目录下是否有组件文件
			if (!(await fse.pathExists(blockFullPath))) {
				return false;
			}

			return await this.hasContentInDirectory(blockFullPath);
		}
	}

	/**
	 * 标记一个 block 为已完成
	 */
	markBlockComplete(blockPath: string): void {
		this.completedBlocks.add(blockPath);
		this.isDirty = true;
	}

	/**
	 * 标记一个页面为已完成
	 */
	markPageComplete(pagePath: string): void {
		this.completedPages.add(pagePath);
		this.isDirty = true;
	}

	/**
	 * 检查一个 block 是否已完成
	 */
	isBlockComplete(blockPath: string): boolean {
		return this.completedBlocks.has(blockPath);
	}

	/**
	 * 检查一个页面是否已完成
	 */
	isPageComplete(pagePath: string): boolean {
		return this.completedPages.has(pagePath);
	}

	/**
	 * 检查是否有进度
	 */
	private hasProgress(): boolean {
		return this.completedBlocks.size > 0 || this.completedPages.size > 0;
	}

	/**
	 * 判断是否应该跳过保存
	 */
	private async shouldSkipSave(): Promise<boolean> {
		// 如果没有变化且文件存在，不需要保存
		if (!this.isDirty && (await fse.pathExists(this.progressFile))) {
			return true;
		}

		// 如果没有任何进度，且已有文件有进度，则不覆盖
		if (!this.hasProgress() && (await fse.pathExists(this.progressFile))) {
			try {
				const existingData = await fse.readJson(this.progressFile);
				const existingHasProgress =
					existingData.completedBlocks?.length > 0 ||
					existingData.completedPages?.length > 0;
				if (existingHasProgress) {
					return true;
				}
			} catch {
				// 读取失败，继续保存
			}
		}

		return false;
	}

	/**
	 * 准备要保存的进度数据
	 */
	private prepareProgressData() {
		return {
			completedBlocks: Array.from(this.completedBlocks),
			completedPages: Array.from(this.completedPages),
			lastUpdate: new Date().toLocaleString(),
			totalBlocks: this.completedBlocks.size,
			totalPages: this.completedPages.size,
		};
	}

	/**
	 * 保存进度到文件
	 */
	async saveProgress(): Promise<void> {
		// 检查是否应该跳过保存
		if (await this.shouldSkipSave()) {
			return;
		}

		// 准备要保存的数据
		const data = this.prepareProgressData();

		// 使用原子写入工具保存
		await atomicWriteJson(this.progressFile, data);

		// 标记为已保存
		this.isDirty = false;
	}

	/**
	 * 同步保存进度到文件（用于信号处理等紧急场景）
	 */
	saveProgressSync(): void {
		try {
			// 准备要保存的数据
			const data = this.prepareProgressData();

			// 使用同步原子写入
			atomicWriteJsonSync(this.progressFile, data);

			// 标记为已保存
			this.isDirty = false;
		} catch (error) {
			console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * 获取已完成的 block 数量
	 */
	getCompletedBlockCount(): number {
		return this.completedBlocks.size;
	}

	/**
	 * 获取已完成的页面数量
	 */
	getCompletedPageCount(): number {
		return this.completedPages.size;
	}

	/**
	 * 清空进度（用于重新开始）
	 */
	async clear(): Promise<void> {
		this.completedBlocks.clear();
		this.completedPages.clear();
		this.isDirty = true;
		await this.saveProgress();
	}

	/**
	 * 删除进度文件
	 */
	async deleteProgressFile(): Promise<void> {
		if (await fse.pathExists(this.progressFile)) {
			await fse.remove(this.progressFile);
		}
	}
}
