import type { Locator } from "@playwright/test";

/**
 * 收集结果类型
 */
export interface CollectResult {
	/** 汇总信息 */
	summary: {
		/** 链接总数 */
		totalLinks: number;
		/** Block 总数 */
		totalBlocks: number;
	};
	/** 集合列表 */
	collections: Array<{
		/** 链接地址 */
		link: string;
		/** 集合名称 */
		name?: string;
		/** Block 数量 */
		blockCount?: number;
	}>;
}

/**
 * 定位符或自定义逻辑
 */
export type LocatorOrCustom<T = Locator> =
	| string
	| ((parent: T) => Locator | Promise<Locator>);

/**
 * 提取函数
 */
export type ExtractFunction<T = string | null> = (text: T) => number;
