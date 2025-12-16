export interface ParsedCurl {
	url: string;
	method: string;
	headers: Record<string, string>;
	cookies: Record<string, string>;
}

export interface FetchOptions {
	/** 并发数，默认 20 */
	concurrency?: number;
	/** 仅测试前 n 个 block，默认 0（不限制） */
	limit?: number;
	/** 输出配置 */
	output?: Partial<OutputOptions>;
}

export interface OutputOptions {
	/** 是否归集 block，默认 true */
	groupBlocks: boolean;
	/** 归集目录名称首字母大写，默认 false */
	groupDirCapitalize: boolean;
	/** 文件名首字母大写，且英文和数字之间用空格分隔（如 Hero 12），默认 false */
	fileCapitalize: boolean;
	/** 组件名称后缀，默认 tsx */
	extension: string;
	/** 是否是新 blocks，默认 false */
	newBlocks: boolean;
}

export interface FetchResult {
	success: number;
	failed: number;
	errors: Array<{ blockName: string; error: string }>;
}
