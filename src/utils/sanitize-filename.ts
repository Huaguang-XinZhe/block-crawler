/**
 * 清理文件名，移除或替换非法字符
 * 确保文件名在所有操作系统上都能正常使用
 *
 * 原则：在保证安全的前提下，尽可能不改变原文件名
 *
 * @param filename 原始文件名
 * @returns 清理后的文件名
 */
export function sanitizeFilename(filename: string): string {
	// Windows 和 Unix 系统都不允许的字符：< > : " / \ | ? *
	// 同时移除控制字符（ASCII 0-31）和删除字符（127）
	// 注意：空格是合法的，不需要替换

	const sanitized =
		filename
			// 替换文件系统不允许的字符
			// Windows: < > : " / \ | ? *
			// Unix/Linux: /
			// 为了跨平台兼容，都需要处理
			// eslint-disable-next-line no-useless-escape
			.replace(/[<>:"/\\|?*]/g, "_")
			// 移除控制字符和删除字符
			// biome-ignore lint/suspicious/noControlCharactersInRegex: This is intended to remove control characters
			.replace(/[\x00-\x1F\x7F]/g, "")
			// 替换连续的点为单个点（防止 .. 等问题）
			.replace(/\.{2,}/g, ".")
			// 移除开头和结尾的点或空格（Windows 不允许）
			.replace(/^[\s.]+|[\s.]+$/g, "")
			// 限制长度（Windows 路径限制 260 字符，文件名部分保留 200 字符）
			.slice(0, 200) ||
		// 如果清理后为空，使用默认名称
		"unnamed";

	return sanitized;
}

/**
 * 清理文件名并返回原始和清理后的文件名
 *
 * @param filename 原始文件名
 * @returns 包含原始文件名和清理后文件名的对象
 */
export function sanitizeFilenameWithOriginal(filename: string): {
	original: string;
	sanitized: string;
	changed: boolean;
} {
	const sanitized = sanitizeFilename(filename);
	return {
		original: filename,
		sanitized,
		changed: filename !== sanitized,
	};
}
