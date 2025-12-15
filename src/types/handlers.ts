import type { Locator, Page } from "@playwright/test";

import type { LocatorOrCustom } from "../collectors/types";
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
	autoScroll?: boolean | { step?: number; interval?: number; timeout?: number };
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

/**
 * 代码提取器函数类型
 * 从 pre 元素中提取代码内容
 */
export type CodeExtractor = (pre: Locator) => Promise<string>;

/**
 * 变种配置
 * 用于配置代码变种切换（如 TypeScript/JavaScript）
 */
export interface VariantConfig {
	/** 切换按钮定位符或自定义逻辑（必需） */
	buttonLocator: LocatorOrCustom<Locator>;
	/** 选项名称到目录名的映射（如 { "TypeScript": "ts", "JavaScript": "js" }） */
	nameMapping?: Record<string, string>;
	/** 切换后等待时间（毫秒，默认 500ms） */
	waitTime?: number;
}

/**
 * Block 自动处理配置
 * 用于自动处理文件 Tab 遍历、代码提取和变种切换
 */
export interface BlockAutoConfig {
	/**
	 * 文件 Tab 容器定位函数（可选）
	 * 接收 region 元素（codeRegion 或 block），返回 Tab 容器的 Locator
	 * 内部会自动调用 container.getByRole(tabRole) 获取所有 Tab 元素
	 *
	 * Tab 名称支持路径格式，如 "base/text-editor/text-editor.tsx"
	 * 会直接复用该路径输出到 outputSubdir 下
	 *
	 * @example
	 * tabContainer: (region) => region.getByRole('tablist')
	 */
	tabContainer?: (region: Locator) => Locator;
	/**
	 * Tab 元素的角色（可选，默认 'tab'）
	 * 用于 container.getByRole(tabRole) 获取所有 Tab 元素
	 *
	 * @example tabRole: 'button'  // 某些网站使用 button 作为 tab
	 */
	tabRole?: "tab" | "button";
	/** 代码提取函数（可选，默认从 pre 获取 textContent） */
	extractCode?: CodeExtractor;
	/** 变种配置列表（可选，支持多个变种） */
	variants?: VariantConfig[];
	/**
	 * 输出子目录（可选）
	 * 相对于 output/域名/ 的子目录路径
	 * @example "components" → output/example.com/components/
	 */
	outputSubdir?: string;
}

/**
 * Block Section 配置
 * 定义一种 block 的定位和处理方式
 */
export interface BlockSectionConfig {
	/**
	 * Block 区块定位符（XPath 或 CSS 选择器）
	 * 可能定位到一个或多个区块
	 */
	sectionLocator: string;
	/**
	 * 预处理逻辑（可选）
	 * 用于“进入代码区域之前”的分步操作：点击 tab、展开折叠、切换状态等。
	 *
	 * - 如果你在 prepare 里已经完成了点击/切换，并且不希望默认再点 Code，
	 *   可以返回 { skipDefaultClick: true }。
	 * - 如果你需要动态决定 codeRegion，可以返回 { codeRegion } 覆盖默认逻辑。
	 */
	prepare?: (context: {
		currentPage: Page;
		block: Locator;
		clickAndVerify: ClickAndVerify;
		clickCode: ClickCode;
	}) => Promise<{ codeRegion?: Locator; skipDefaultClick?: boolean } | void>;
	/**
	 * 点击定位器（可选）
	 * 定位到 block 后执行点击，进入代码区域
	 * 使用 100ms 超时快速判断元素是否存在
	 * @deprecated 建议使用 prepare 统一管理预处理步骤
	 */
	clickLocator?: (block: Locator) => Locator;
	/**
	 * 代码区域（可选）
	 * 指定在 block 的哪个子区域内提取代码，避免超匹配
	 * @example codeRegion: (block) => block.locator('[data-code-panel]')
	 * @deprecated 建议使用 prepare 返回 codeRegion，避免分散配置
	 */
	codeRegion?: (block: Locator) => Locator;
	/**
	 * 代码提取配置（推荐字段名）
	 */
	extractConfig?: BlockAutoConfig;
	/**
	 * @deprecated 请使用 extractConfig（旧字段名仍兼容）
	 */
	config?: BlockAutoConfig;
	/**
	 * 跳过前置检查（可选，默认 false）
	 * 设为 true 时跳过：获取 blockName、进度检查、skipFree 检查
	 * 适用于非单个组件的场景（如多 Tab 代码提取）
	 */
	skipPreChecks?: boolean;
}

/**
 * @deprecated 请使用 BlockSectionConfig
 * 条件 Block 配置（保留用于向后兼容）
 */
export interface ConditionalBlockConfig {
	/**
	 * 条件 Locator（用于快速判断该使用哪个配置）
	 * 执行时会用 100ms 超时尝试获取元素，获取成功后直接点击
	 * @deprecated 请使用 BlockSectionConfig.clickLocator
	 */
	when: (block: Locator) => Locator;
	/**
	 * 匹配后的配置
	 */
	config: BlockAutoConfig;
	/**
	 * 代码区域（可选）
	 * 指定在 block 的哪个子区域内提取代码，避免超匹配
	 * @example codeRegion: (block) => block.locator('[data-code-panel]')
	 */
	codeRegion?: (block: Locator) => Locator;
	/**
	 * 跳过前置检查（可选，默认 false）
	 * 设为 true 时跳过：获取 blockName、进度检查、skipFree 检查
	 * 适用于非单个组件的场景（如多 Tab 代码提取）
	 */
	skipPreChecks?: boolean;
}
