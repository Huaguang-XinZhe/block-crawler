import fs from "node:fs";
import path from "node:path";

/**
 * 从 JSON 对象中根据路径提取值
 * @param obj - JSON 对象
 * @param pathStr - 路径，如 .files[0].content 或 files[0].content
 */
export function getValueByPath(obj: unknown, pathStr: string): unknown {
	const normalizedPath = pathStr.startsWith(".") ? pathStr.slice(1) : pathStr;
	const parts: (string | number)[] = [];
	const regex = /([^.\[\]]+)|\[(\d+)\]/g;
	let match: RegExpExecArray | null;

	while ((match = regex.exec(normalizedPath)) !== null) {
		if (match[1]) {
			parts.push(match[1]);
		} else if (match[2]) {
			parts.push(parseInt(match[2], 10));
		}
	}

	let result: unknown = obj;
	for (const part of parts) {
		if (result === null || result === undefined) return undefined;
		result = (result as Record<string | number, unknown>)[part];
	}
	return result;
}

/**
 * 出错时重试一次，可在重试前执行自定义逻辑
 * @param action - 主要执行的操作
 * @param onError - 出错后、重试前执行的操作（可选）
 */
export async function retryOnce<T>(
	action: () => Promise<T>,
	onError?: () => Promise<void>,
): Promise<T> {
	try {
		return await action();
	} catch {
		await onError?.();
		return await action();
	}
}

/** 首字母大写 */
export function capitalize(str: string): string {
	return str.charAt(0).toUpperCase() + str.slice(1);
}

/** 将 cookies 对象转为 Cookie 字符串 */
export function cookiesToString(cookies: Record<string, string>): string {
	return Object.entries(cookies)
		.map(([key, value]) => `${key}=${value}`)
		.join("; ");
}

/** 寻找根目录 */
export function findProjectRoot(): string {
	const gitDir = findNearestFile(".git");
	if (!gitDir) {
		throw new Error("未找到项目根目录（无 .git 目录）");
	}
	return path.dirname(gitDir);
}

/**
 * 向上查找文件或目录
 * @param targetName 目标文件或目录名
 * @param startDir 开始查找的目录，默认为 process.cwd()
 * @returns 找到的完整路径，未找到返回 null
 */
export function findNearestFile(
	targetName: string,
	startDir: string = process.cwd(),
): string | null {
	let currentDir = startDir;
	const { root } = path.parse(currentDir);

	while (true) {
		const fullPath = path.join(currentDir, targetName);
		if (fs.existsSync(fullPath)) {
			return fullPath;
		}

		if (currentDir === root) {
			return null;
		}

		currentDir = path.dirname(currentDir);
	}
}
