import type { Page } from "@playwright/test";

/**
 * 自动滚动配置
 */
export interface AutoScrollConfig {
	/** 每次滚动的距离（像素），默认 1000 */
	step?: number;
	/** 滚动间隔（毫秒），默认 500 */
	interval?: number;
	/** 超时时间（毫秒），默认从测试超时中计算 */
	timeout?: number;
}

/**
 * 自动滚动结果
 */
export interface AutoScrollResult {
	/** 是否成功滚动到底 */
	success: boolean;
	/** 滚动耗时（秒） */
	duration: number;
	/** 错误信息（如果有） */
	error?: string;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG = {
	step: 800,
	interval: 500,
	timeout: 120000, // 默认 120 秒
};

/**
 * 自动滚动页面到底部
 *
 * 使用 mouse.wheel 模拟真实鼠标滚动，比 window.scrollBy 更稳定
 *
 * @param page - Playwright Page 对象
 * @param config - 滚动配置
 * @returns 滚动结果
 */
export async function autoScrollToBottom(
	page: Page,
	config: AutoScrollConfig = {},
): Promise<AutoScrollResult> {
	const step = config.step ?? DEFAULT_CONFIG.step;
	const interval = config.interval ?? DEFAULT_CONFIG.interval;
	const timeout = config.timeout ?? DEFAULT_CONFIG.timeout;

	const startTime = Date.now();

	try {
		// 使用 mouse.wheel 模拟真实滚动
		let lastScrollTop = -1;
		let unchangedCount = 0;

		while (true) {
			// 检查超时
			if (Date.now() - startTime > timeout) {
				return {
					success: false,
					duration: (Date.now() - startTime) / 1000,
					error: "滚动超时",
				};
			}

			// 获取当前滚动位置
			const scrollInfo = await page.evaluate(() => ({
				scrollTop: window.pageYOffset || document.documentElement.scrollTop,
				scrollHeight: document.body.scrollHeight,
				clientHeight: window.innerHeight,
			}));

			// 检测是否到达底部（考虑 10px 误差）
			if (
				scrollInfo.scrollTop + scrollInfo.clientHeight >=
				scrollInfo.scrollHeight - 10
			) {
				return {
					success: true,
					duration: (Date.now() - startTime) / 1000,
				};
			}

			// 检测滚动位置是否变化（卡住检测）
			if (Math.abs(scrollInfo.scrollTop - lastScrollTop) < 5) {
				unchangedCount++;
				// 如果连续 3 次滚动位置基本不变，认为已经到底或卡住
				if (unchangedCount >= 3) {
					return {
						success: true,
						duration: (Date.now() - startTime) / 1000,
					};
				}
			} else {
				unchangedCount = 0;
				lastScrollTop = scrollInfo.scrollTop;
			}

			// 使用 mouse.wheel 模拟滚动
			await page.mouse.wheel(0, step);

			// 等待一段时间，让页面有时间加载内容
			await page.waitForTimeout(interval);
		}
	} catch (error) {
		return {
			success: false,
			duration: (Date.now() - startTime) / 1000,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * 格式化滚动配置信息（用于日志）
 */
export function formatScrollConfig(config: AutoScrollConfig): {
	isDefault: boolean;
	info: string;
} {
	const step = config.step ?? DEFAULT_CONFIG.step;
	const interval = config.interval ?? DEFAULT_CONFIG.interval;
	const timeout = config.timeout ?? DEFAULT_CONFIG.timeout;

	const isDefault =
		step === DEFAULT_CONFIG.step &&
		interval === DEFAULT_CONFIG.interval &&
		timeout === DEFAULT_CONFIG.timeout;

	const info = `step=${step}px, interval=${interval}ms, timeout=${timeout}ms`;

	return { isDefault, info };
}
