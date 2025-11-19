import ora, { type Ora } from "ora";

/**
 * 进度管理器 - 封装进度显示逻辑
 * 职责：管理任务进度的显示和更新
 */
export class ProgressManager {
	private spinner: Ora | null = null;
	private total: number = 0;
	private completed: number = 0;
	private startTime: number = 0;

	/**
	 * 开始进度跟踪
	 * @param total 总任务数
	 * @param initialMessage 初始消息
	 */
	start(total: number, initialMessage: string = "开始处理..."): void {
		this.total = total;
		this.completed = 0;
		this.startTime = Date.now();

		this.spinner = ora({
			text: initialMessage,
			color: "cyan",
			spinner: "dots",
		}).start();
	}

	/**
	 * 更新进度
	 * @param taskName 当前任务名称（可选）
	 */
	update(taskName?: string): void {
		if (!this.spinner) return;

		this.completed++;
		const percentage = ((this.completed / this.total) * 100).toFixed(1);
		const elapsed = this.getElapsedTime();
		const eta = this.getETA();

		let text = `📊 进度: ${this.completed}/${this.total} (${percentage}%) | 耗时: ${elapsed}`;

		if (eta) {
			text += ` | 预计剩余: ${eta}`;
		}

		if (taskName) {
			text += ` | 当前: ${taskName}`;
		}

		this.spinner.text = text;
	}

	/**
	 * 标记为成功完成
	 * @param message 完成消息
	 */
	succeed(message?: string): void {
		if (!this.spinner) return;

		const finalMessage =
			message ||
			`🎊 所有 ${this.total} 个任务处理完成！总耗时: ${this.getElapsedTime()}`;
		this.spinner.succeed(finalMessage);
		this.spinner = null;
	}

	/**
	 * 标记为失败
	 * @param message 失败消息
	 */
	fail(message: string): void {
		if (!this.spinner) return;

		this.spinner.fail(message);
		this.spinner = null;
	}

	/**
	 * 停止并清除进度显示
	 */
	stop(): void {
		if (this.spinner) {
			this.spinner.stop();
			this.spinner = null;
		}
	}

	/**
	 * 获取已用时间（格式化）
	 */
	private getElapsedTime(): string {
		const seconds = (Date.now() - this.startTime) / 1000;
		return this.formatTime(seconds);
	}

	/**
	 * 估算剩余时间（ETA）
	 */
	private getETA(): string | null {
		if (this.completed === 0) return null;

		const elapsed = (Date.now() - this.startTime) / 1000;
		const avgTimePerTask = elapsed / this.completed;
		const remaining = (this.total - this.completed) * avgTimePerTask;

		return this.formatTime(remaining);
	}

	/**
	 * 格式化时间显示
	 */
	private formatTime(seconds: number): string {
		if (seconds < 60) {
			return `${seconds.toFixed(1)}s`;
		}

		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = Math.floor(seconds % 60);
		return `${minutes}m ${remainingSeconds}s`;
	}

	/**
	 * 获取当前完成数量
	 */
	getCompleted(): number {
		return this.completed;
	}

	/**
	 * 获取总任务数
	 */
	getTotal(): number {
		return this.total;
	}
}
