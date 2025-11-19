import type {
	BeforeProcessBlocksHandler,
	BlockHandler,
} from "../types/handlers";

/**
 * Block 模式配置选项
 */
export interface BlockModeOptions {
	/**
	 * 是否在处理 Block 后进行验证（检查名称是否匹配）
	 * @default true
	 */
	verifyBlockCompletion?: boolean;
}

/**
 * Block 模式配置
 */
export interface BlockModeConfig {
	sectionLocator: string;
	handler: BlockHandler;
	beforeHandler?: BeforeProcessBlocksHandler;
	options?: BlockModeOptions;
}

/**
 * Block 处理模式 (Builder Pattern)
 *
 * 职责：只负责收集配置，不执行任何操作
 *
 * @example
 * const mode = new BlockMode('[data-preview]')
 *   .before(async (page) => { ... })
 *   .handler(async ({ block }) => { ... });
 * const config = mode.getConfig();
 */
export class BlockMode {
	private config: Partial<BlockModeConfig>;

	constructor(sectionLocator: string, options?: BlockModeOptions) {
		this.config = {
			sectionLocator,
			options,
		};
	}

	/**
	 * 设置前置处理函数
	 */
	before(handler: BeforeProcessBlocksHandler): this {
		this.config.beforeHandler = handler;
		return this;
	}

	/**
	 * 设置 Block 处理函数
	 */
	handler(handler: BlockHandler): this {
		this.config.handler = handler;
		return this;
	}

	/**
	 * 获取配置（供 BlockCrawler 读取）
	 */
	getConfig(): BlockModeConfig {
		if (!this.config.handler) {
			throw new Error("必须设置 Block handler");
		}
		return this.config as BlockModeConfig;
	}
}
