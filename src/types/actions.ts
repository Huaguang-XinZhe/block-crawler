import type { Locator } from "@playwright/test";

/**
 * 点击并验证函数类型
 * 用于验证点击效果，支持重试
 *
 * @param locator 要点击的定位器
 * @param verifyFn 验证函数（可选），返回 true 表示验证通过。如果不提供，将自动根据元素的 role 选择验证方式
 * @param options 可选配置（timeout、retries）
 * @throws 验证失败时抛出错误
 *
 * **自动验证规则（当 verifyFn 不提供时）：**
 * - `role="tab"` → 验证 `aria-selected="true"`
 * - 其他 role → 验证元素可见性
 *
 * @example
 * // 使用自动验证（tab 元素会自动验证 aria-selected）
 * await clickAndVerify(page.getByRole('tab', { name: 'Code' }));
 *
 * @example
 * // 自定义验证
 * await clickAndVerify(
 *   page.getByRole('button', { name: 'Open' }),
 *   async () => (await page.getByText('Content').count()) > 0,
 *   { timeout: 5000, retries: 3 }
 * );
 */
export type ClickAndVerify = (
	locator: Locator,
	verifyFn?: () => Promise<boolean>,
	options?: { timeout?: number; retries?: number },
) => Promise<void>;

/**
 * 点击 Code 按钮函数类型
 * 内部使用 clickAndVerify 实现
 *
 * @param locator 可选的自定义定位器，默认为 getByRole('tab', { name: 'Code' })
 * @param options 可选配置（timeout、retries）
 *
 * @example
 * // 使用默认定位器
 * await clickCode();
 *
 * // 使用自定义定位器
 * await clickCode(block.getByRole('button', { name: 'Show Code' }));
 */
export type ClickCode = (
	locator?: Locator,
	options?: { timeout?: number; retries?: number },
) => Promise<void>;
