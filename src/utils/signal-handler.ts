import { createI18n, type Locale } from "./i18n";

/**
 * 信号处理器
 *
 * 职责：
 * - 统一处理 SIGINT/SIGTERM 信号
 * - 执行清理回调
 * - 防止重复处理
 * - 确保优雅退出
 *
 * @example
 * ```typescript
 * const handler = new SignalHandler(locale, () => {
 *   // 清理逻辑
 *   this.orchestrator?.cleanupSync();
 * });
 *
 * handler.setup();
 * // ... 执行任务
 * handler.cleanup(); // 在 finally 中调用
 * ```
 */
export class SignalHandler {
	private i18n: ReturnType<typeof createI18n>;
	private signalHandler?: (signal: NodeJS.Signals) => void;
	private static isTerminating = false;
	private static handlingSignal = false;

	/**
	 * 检查是否正在终止
	 */
	static isProcessTerminating(): boolean {
		return SignalHandler.isTerminating;
	}

	/**
	 * 重置状态（主要用于测试）
	 */
	static resetState(): void {
		SignalHandler.isTerminating = false;
		SignalHandler.handlingSignal = false;
	}

	constructor(
		locale: Locale | undefined,
		private cleanupCallback: () => void,
	) {
		this.i18n = createI18n(locale);
	}

	/**
	 * 设置信号处理器
	 */
	setup(): void {
		const handler = (signal: NodeJS.Signals) => {
			// 防止重复处理
			if (SignalHandler.handlingSignal) {
				return;
			}
			SignalHandler.handlingSignal = true;
			SignalHandler.isTerminating = true;

			console.log(`\n${this.i18n.t("common.signalReceived", { signal })}\n`);

			// 立即移除信号处理器，防止再次触发
			this.remove();

			// 同步执行清理并退出
			this.performCleanupAndExit();
		};

		process.once("SIGINT", handler);
		process.once("SIGTERM", handler);
		this.signalHandler = handler;
	}

	/**
	 * 执行清理并退出
	 */
	private performCleanupAndExit(): void {
		try {
			// 执行清理回调
			this.cleanupCallback();
			console.log(`\n${this.i18n.t("common.stateSaved")}\n`);
		} catch (error) {
			console.error(
				this.i18n.t("progress.saveFailed", {
					error: error instanceof Error ? error.message : String(error),
				}),
			);
		} finally {
			// 确保退出
			process.exit(0);
		}
	}

	/**
	 * 移除信号处理器
	 */
	remove(): void {
		if (this.signalHandler) {
			process.off("SIGINT", this.signalHandler);
			process.off("SIGTERM", this.signalHandler);
			this.signalHandler = undefined;
		}
	}

	/**
	 * 清理（别名，用于 finally 块）
	 */
	cleanup(): void {
		this.remove();
	}
}
