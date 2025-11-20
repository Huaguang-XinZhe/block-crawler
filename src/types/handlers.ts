import type { Locator, Page } from "@playwright/test";

import type { SafeOutput } from "../utils/safe-output";
import type { ClickAndVerify, ClickCode } from "./actions";

/**
 * 页面处理上下文
 */
export interface PageContext {
	/** 当前正在处理的页面（可能是 newPage，而不是原始测试 page） */
	currentPage: Page;
	/** 当前路径（相对路径） */
	currentPath: string;
	/** 输出目录 */
	outputDir: string;
	/** 安全输出函数（自动处理文件名 sanitize） */
	safeOutput: SafeOutput;
	/** 点击并验证函数 */
	clickAndVerify: ClickAndVerify;
	/** 点击 Code 按钮函数 */
	clickCode: ClickCode;
}

/**
 * Block 处理上下文
 */
export interface BlockContext {
	/** 当前正在处理的页面（可能是 newPage，而不是原始测试 page） */
	currentPage: Page;
	/** Block 元素 */
	block: Locator;
	/** block 路径（URL 路径 + Block 名称） */
	blockPath: string;
	/** Block 名称 */
	blockName: string;
	/** 输出目录 */
	outputDir: string;
	/** 安全输出函数（自动处理文件名 sanitize，默认路径：${outputDir}/${blockPath}.tsx） */
	safeOutput: SafeOutput;
	/** 点击并验证函数 */
	clickAndVerify: ClickAndVerify;
	/** 点击 Code 按钮函数 */
	clickCode: ClickCode;
}

/**
 * Before 处理上下文（用于 before 函数）
 */
export interface BeforeContext {
	/** 当前正在处理的页面（可能是 newPage，而不是原始测试 page） */
	currentPage: Page;
	/** 点击并验证函数 */
	clickAndVerify: ClickAndVerify;
}

/**
 * 页面处理器函数类型
 */
export type PageHandler = (context: PageContext) => Promise<void>;

/**
 * 页面处理配置对象类型
 */
export interface PageConfig {
	/** 页面处理器函数（可选，如果只需要自动滚动可以不提供） */
	handler?: PageHandler;
	/** 自动滚动配置（默认关闭） */
	autoScroll?: boolean | { step?: number; interval?: number };
}

/**
 * Block 处理器函数类型
 */
export type BlockHandler = (context: BlockContext) => Promise<void>;

/**
 * Block 处理前置函数类型
 * 在匹配页面所有 Block 之前执行的前置逻辑（如点击按钮、toggle 切换等）
 *
 * @param context Before 处理上下文
 *
 * @example
 * async ({ currentPage, clickAndVerify }) => {
 *   await clickAndVerify(
 *     currentPage.getByRole('button', { name: 'Show All' }),
 *     async () => (await currentPage.getByText('Content').count()) > 0
 *   );
 * }
 */
export type BeforeProcessBlocksHandler = (
	context: BeforeContext,
) => Promise<void>;

/**
 * 测试模式上下文
 */
export interface TestContext {
	/** 当前页面 */
	currentPage: Page;
	/** 目标 section */
	section: Locator;
	/** Block 名称 */
	blockName: string;
	/** 输出目录 */
	outputDir: string;
	/** 安全输出函数（自动处理文件名 sanitize，默认路径：${outputDir}/test-${blockName}.tsx） */
	safeOutput: SafeOutput;
	/** 点击并验证函数 */
	clickAndVerify: ClickAndVerify;
	/** 点击 Code 按钮函数 */
	clickCode: ClickCode;
}

/**
 * 测试模式处理函数类型
 */
export type TestHandler = (context: TestContext) => Promise<void>;
