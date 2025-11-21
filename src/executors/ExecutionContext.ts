import type { Locator, Page } from "@playwright/test";
import pLimit from "p-limit";
import type { InternalConfig } from "../config/ConfigManager";
import { BlockNameExtractor } from "../processors/BlockNameExtractor";
import { ScriptInjector } from "../processors/ScriptInjector";
import { FilenameMappingManager } from "../state/FilenameMapping";
import { FreeRecorder } from "../state/FreeRecorder";
import type { TaskProgress } from "../state/TaskProgress";
import type { I18n } from "../utils/i18n";

/**
 * 扩展的执行配置（包含处理器需要的配置项）
 */
export interface ExtendedExecutionConfig {
	getBlockName?: (block: Locator) => Promise<string | null>;
	blockNameLocator?: string;
	getAllBlocks?: (page: Page) => Promise<Locator[]>;
	scriptInjection?: boolean | { enabled: boolean; scripts?: string[] };
	/**
	 * skipFree 支持 Page 级别和 Block 级别：
	 *   - undefined: 未启用跳过
	 *   - null: 使用默认匹配 /free/i（忽略大小写）
	 *   - string: 精确匹配指定文本
	 *   - function: 自定义判断逻辑
	 */
	skipFree?:
		| string
		| null
		| ((page: Page) => Promise<boolean>)
		| ((locator: Locator) => Promise<boolean>);
}

/**
 * 执行上下文
 *
 * 职责：
 * - 集中管理所有执行过程中需要的管理器
 * - 提供统一的访问接口
 */
export class ExecutionContext {
	public readonly freeRecorder: FreeRecorder;
	public readonly scriptInjector: ScriptInjector;
	public readonly blockNameExtractor: BlockNameExtractor;
	public readonly filenameMappingManager: FilenameMappingManager;
	public readonly limit: ReturnType<typeof pLimit>;
	public readonly extendedConfig: ExtendedExecutionConfig;
	public readonly baseUrlPath: string;

	constructor(
		public readonly config: InternalConfig,
		public readonly baseUrl: string,
		public readonly outputDir: string,
		stateDir: string,
		freeFile: string,
		public readonly taskProgress: TaskProgress | undefined,
		public readonly i18n: I18n,
		extendedConfig: ExtendedExecutionConfig = {},
	) {
		this.extendedConfig = extendedConfig;
		this.freeRecorder = new FreeRecorder(freeFile);
		this.scriptInjector = new ScriptInjector(
			config,
			stateDir,
			extendedConfig.scriptInjection,
		);
		this.blockNameExtractor = new BlockNameExtractor(config, extendedConfig);
		this.filenameMappingManager = new FilenameMappingManager(
			stateDir,
			config.locale,
		);
		this.limit = pLimit(config.maxConcurrency);

		// 解析 startUrl 的路径部分（用于从日志路径中排除）
		try {
			const url = new URL(baseUrl);
			this.baseUrlPath = url.pathname === "/" ? "" : url.pathname;
		} catch {
			this.baseUrlPath = "";
		}
	}

	/**
	 * 初始化所有管理器
	 */
	async initialize(): Promise<void> {
		// 初始化任务进度
		if (this.taskProgress) {
			console.log(`\n${this.i18n.t("crawler.initProgress")}`);
			await this.taskProgress.initialize();
		}

		// 初始化 Free 记录器
		await this.freeRecorder.initialize();

		// 初始化文件名映射管理器
		await this.filenameMappingManager.initialize();
	}

	/**
	 * 清理资源（保存进度和 Free 记录）
	 */
	async cleanup(): Promise<void> {
		// 保存进度
		if (this.taskProgress) {
			await this.taskProgress.saveProgress();
			console.log(
				`\n${this.i18n.t("progress.saved", {
					blocks: this.taskProgress.getCompletedBlockCount(),
					pages: this.taskProgress.getCompletedPageCount(),
				})}`,
			);
		}

		// 保存 Free 记录
		await this.freeRecorder.save();

		// 保存文件名映射
		await this.filenameMappingManager.save();
	}
}
