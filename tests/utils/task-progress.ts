import path from "node:path";
import fse from "fs-extra";

/**
 * 任务进度管理器
 * 用于记录爬取进度，支持中断恢复
 */
export class TaskProgress {
	private progressFile: string;
	private outputDir: string;
	private completedBlocks: Set<string>;
	private isDirty: boolean = false;

	constructor(
		progressFile: string = "progress.json",
		outputDir: string = "output",
	) {
		this.progressFile = progressFile;
		this.outputDir = outputDir;
		this.completedBlocks = new Set();
	}

	/**
	 * 初始化：加载或重建进度
	 */
	async initialize(): Promise<void> {
		if (await fse.pathExists(this.progressFile)) {
			console.log("📁 发现进度文件，加载中...");
			await this.loadProgress();
			console.log(`✅ 已加载 ${this.completedBlocks.size} 个已完成的 block`);
		} else {
			console.log("📁 进度文件不存在，扫描输出目录重建进度...");
			await this.rebuildProgress();
			console.log(
				`✅ 重建完成，找到 ${this.completedBlocks.size} 个已完成的 block`,
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
		} catch (error) {
			console.warn("⚠️ 加载进度文件失败，将重建进度", error);
			await this.rebuildProgress();
		}
	}

	/**
	 * 重建进度：扫描 OUTPUT_DIR
	 * 逻辑：
	 * 1. 扫描所有 4 段的 block 目录（例如：components/application/authentication/Left Sign Up）
	 * 2. 对比 js 和 ts 目录的文件数，一致则认为已完成
	 */
	private async rebuildProgress(): Promise<void> {
		if (!(await fse.pathExists(this.outputDir))) {
			console.log("📂 输出目录不存在，跳过重建");
			return;
		}

		const completedBlocks: string[] = [];

		// 递归扫描，找到所有 4 段的路径
		const scanDir = async (
			currentPath: string,
			depth: number = 0,
		): Promise<void> => {
			const fullPath = path.join(this.outputDir, currentPath);

			if (!(await fse.pathExists(fullPath))) {
				return;
			}

			const entries = await fse.readdir(fullPath, { withFileTypes: true });

			for (const entry of entries) {
				if (!entry.isDirectory()) continue;

				const newPath = currentPath
					? `${currentPath}/${entry.name}`
					: entry.name;
				const newDepth = depth + 1;

				// 如果是第 4 段（block 目录），检查完成状态
				if (newDepth === 4) {
					const isComplete = await this.checkBlockComplete(newPath);
					if (isComplete) {
						completedBlocks.push(newPath);
					}
				} else if (newDepth < 4) {
					// 继续递归
					await scanDir(newPath, newDepth);
				}
			}
		};

		await scanDir("");

		this.completedBlocks = new Set(completedBlocks);

		// 保存重建的进度
		if (completedBlocks.length > 0) {
			await this.saveProgress();
		}
	}

	/**
	 * 检查一个 block 是否完成
	 * 完成条件：js 目录和 ts 目录的文件数一致
	 */
	private async checkBlockComplete(blockPath: string): Promise<boolean> {
		const blockFullPath = path.join(this.outputDir, blockPath);
		const jsDir = path.join(blockFullPath, "js");
		const tsDir = path.join(blockFullPath, "ts");

		// 两个目录都必须存在
		if (!(await fse.pathExists(jsDir)) || !(await fse.pathExists(tsDir))) {
			return false;
		}

		try {
			const jsFiles = (await fse.readdir(jsDir)).filter(
				(f) => !f.startsWith("."),
			);
			const tsFiles = (await fse.readdir(tsDir)).filter(
				(f) => !f.startsWith("."),
			);

			// 文件数必须一致且大于 0
			return jsFiles.length > 0 && jsFiles.length === tsFiles.length;
		} catch (_error) {
			return false;
		}
	}

	/**
	 * 标记一个 block 为已完成
	 */
	markComplete(blockPath: string): void {
		this.completedBlocks.add(blockPath);
		this.isDirty = true;
	}

	/**
	 * 检查一个 block 是否已完成
	 */
	isComplete(blockPath: string): boolean {
		return this.completedBlocks.has(blockPath);
	}

	/**
	 * 保存进度到文件
	 */
	async saveProgress(): Promise<void> {
		if (!this.isDirty && (await fse.pathExists(this.progressFile))) {
			return; // 没有变化且文件存在，不需要保存
		}

		const data = {
			completedBlocks: Array.from(this.completedBlocks),
			lastUpdate: new Date().toLocaleString(),
			total: this.completedBlocks.size,
		};

		// 使用 outputJson 自动确保目录存在并写入
		await fse.outputJson(this.progressFile, data, { spaces: 2 });
		this.isDirty = false;
	}

	/**
	 * 获取已完成的数量
	 */
	getCompletedCount(): number {
		return this.completedBlocks.size;
	}

	/**
	 * 清空进度（用于重新开始）
	 */
	async clear(): Promise<void> {
		this.completedBlocks.clear();
		this.isDirty = true;
		await this.saveProgress();
	}

	/**
	 * 删除进度文件
	 */
	async deleteProgressFile(): Promise<void> {
		if (await fse.pathExists(this.progressFile)) {
			await fse.remove(this.progressFile);
			console.log("🗑️ 已删除进度文件");
		}
	}
}
