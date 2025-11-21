/**
 * 上下文日志记录器
 *
 * 职责：
 * - 为并发环境提供带上下文的日志输出
 * - 统一日志格式：[/path]: 消息内容
 * - 支持不同日志级别
 */
export class ContextLogger {
	constructor(private context: string = "") {}

	/**
	 * 更新日志上下文
	 */
	setContext(context: string): void {
		this.context = context;
	}

	/**
	 * 获取当前上下文
	 */
	getContext(): string {
		return this.context;
	}

	/**
	 * 计算上下文前缀的显示长度（包括括号和冒号）
	 */
	private getContextPrefixLength(): number {
		if (!this.context) {
			return 0;
		}
		// [/path]: 的长度
		return this.context.length + 4;
	}

	/**
	 * 格式化日志消息
	 */
	private format(message: string): string {
		if (!this.context) {
			return message;
		}
		return `[${this.context}]: ${message}`;
	}

	/**
	 * 普通日志
	 */
	log(message: string): void {
		console.log(this.format(message));
	}

	/**
	 * 输出列表项（对齐到路径后面）
	 */
	logItem(key: string, value: string | number): void {
		const prefixLength = this.getContextPrefixLength();
		const indent = " ".repeat(prefixLength);
		console.log(`${indent}  - ${key}: ${value}`);
	}

	/**
	 * 输出多个列表项
	 */
	logItems(items: Record<string, string | number>): void {
		for (const [key, value] of Object.entries(items)) {
			this.logItem(key, value);
		}
	}

	/**
	 * 警告日志
	 */
	warn(message: string): void {
		console.warn(this.format(message));
	}

	/**
	 * 错误日志
	 */
	error(message: string, error?: unknown): void {
		if (error) {
			console.error(this.format(message), error);
		} else {
			console.error(this.format(message));
		}
	}

	/**
	 * 创建子日志记录器
	 * 用于在同一页面内处理不同阶段
	 */
	child(suffix: string): ContextLogger {
		const newContext = this.context ? `${this.context}/${suffix}` : suffix;
		return new ContextLogger(newContext);
	}
}

/**
 * 创建日志记录器
 */
export function createLogger(context: string = ""): ContextLogger {
	return new ContextLogger(context);
}

/**
 * 全局日志记录器（无上下文）
 */
export const globalLogger = new ContextLogger();
