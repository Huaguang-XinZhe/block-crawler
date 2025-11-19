/**
 * 进度恢复配置
 */
export interface ProgressConfig {
	/**
	 * 是否启用进度恢复功能
	 *
	 * - 开启：先检查 progress.json，没有则重建
	 * - 关闭：从头开始（仍会跳过 Free，如果设置了 skipFree）
	 *
	 * @default true
	 */
	enable?: boolean;
	/**
	 * 进度重建配置（从 outputDir 扫描已有文件）
	 */
	rebuild?: ProgressRebuildConfig;
}

/**
 * 进度重建配置
 */
export interface ProgressRebuildConfig {
	/**
	 * Block 类型
	 * - 'file': block 是文件（如 untitledui）
	 * - 'directory': block 是目录（如 heroui）
	 *
	 * @default 'file'
	 */
	blockType?: "file" | "directory";
	/**
	 * 是否保存重建结果到 progress.json
	 *
	 * @default true
	 */
	saveToProgress?: boolean;
	/**
	 * 自定义检查 block 是否完成的函数
	 *
	 * 如果不提供，将使用默认逻辑：
	 * - blockType='file': 检查文件是否存在
	 * - blockType='directory': 检查目录是否存在
	 *
	 * @param blockPath block 的路径（相对于 page 目录）
	 * @param outputDir 输出目录的绝对路径
	 * @returns 是否完成
	 *
	 * @example
	 * async (blockPath, outputDir) => {
	 *   const dir = path.join(outputDir, blockPath);
	 *   const files = await fse.readdir(dir);
	 *   return files.some(f => f.endsWith('.tsx') && f.includes('index'));
	 * }
	 */
	checkBlockComplete?: (
		blockPath: string,
		outputDir: string,
	) => Promise<boolean>;
}
