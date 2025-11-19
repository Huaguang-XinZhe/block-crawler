/**
 * 检测是否处于调试模式
 *
 * 支持检测以下环境变量：
 * - PWDEBUG: Playwright 官方 debug 模式
 * - PW_TEST_DEBUG: Playwright Test debug 模式
 * - PLAYWRIGHT_INSPECTOR: Playwright Inspector 模式
 *
 * @returns 是否处于调试模式
 */
export function isDebugMode(): boolean {
	return Boolean(
		process.env.PWDEBUG ||
			process.env.PW_TEST_DEBUG ||
			process.env.PLAYWRIGHT_INSPECTOR,
	);
}
