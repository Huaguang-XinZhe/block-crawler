import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import fse from "fs-extra";

/**
 * 原子写入选项
 */
export interface AtomicWriteOptions {
	/** 最大重试次数，默认 3 */
	maxRetries?: number;
	/** 重试间隔（毫秒），默认 100 */
	retryDelay?: number;
	/** 是否验证写入后的内容，默认 true */
	verify?: boolean;
}

/**
 * 原子写入 JSON 文件
 *
 * 使用临时文件 + 原子替换的方式确保写入的原子性：
 * 1. 在系统临时目录创建临时文件
 * 2. 先写入临时文件
 * 3. 验证临时文件内容
 * 4. 原子性替换（move）
 * 5. 验证最终文件
 * 6. 失败时自动重试
 *
 * @param filePath 目标文件路径
 * @param data 要写入的数据
 * @param options 写入选项
 * @throws 如果所有重试都失败，抛出错误
 */
export async function atomicWriteJson<T extends object>(
	filePath: string,
	data: T,
	options: AtomicWriteOptions = {},
): Promise<void> {
	const { maxRetries = 3, retryDelay = 100, verify = true } = options;

	// 在系统临时目录创建临时文件，使用 UUID 确保唯一性
	const tempFileName = `block-crawler-${randomUUID()}.tmp`;
	const tempFile = path.join(os.tmpdir(), tempFileName);
	let retries = maxRetries;
	let lastError: Error | null = null;

	while (retries > 0) {
		try {
			// 1. 先写入临时文件
			await fse.outputJson(tempFile, data, { spaces: 2 });

			// 2. 验证临时文件（如果启用）
			if (verify) {
				const tempContent = await fse.readJson(tempFile);
				if (!tempContent || Object.keys(tempContent).length === 0) {
					throw new Error("写入的文件内容为空");
				}
			}

			// 3. 原子性替换：将临时文件移动到目标文件位置
			await fse.move(tempFile, filePath, { overwrite: true });

			// 4. 验证最终文件（如果启用）
			if (verify) {
				const finalContent = await fse.readJson(filePath);
				if (!finalContent || Object.keys(finalContent).length === 0) {
					throw new Error("最终文件内容为空");
				}
			}

			// 写入成功，返回
			return;
		} catch (error) {
			lastError = error as Error;
			retries--;

			// 清理临时文件
			if (await fse.pathExists(tempFile)) {
				await fse.remove(tempFile).catch(() => {});
			}

			if (retries > 0) {
				// 等待后重试
				await new Promise((resolve) => setTimeout(resolve, retryDelay));
			} else {
				// 所有重试都失败，抛出错误
				throw new Error(`原子写入失败: ${lastError.message}`);
			}
		}
	}
}
