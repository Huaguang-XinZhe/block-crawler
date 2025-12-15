import { type Locator } from "@playwright/test";
import { retryOnce } from "../shared/utils";

interface ForEachBlockOptions {
	/** blockName 获取配置 */
	blockName?: {
		/** 定位器（相对于 block），默认使用 getByRole('heading') */
		locator?: Locator;
		/** 超时时间（毫秒），默认 1000 */
		timeout?: number;
		/**
		 * 当无法获取 heading 时的 fallback
		 * - 字符串: 作为前缀，生成 `${fallback}-${blockIndex + 1}`
		 * - 函数: 接收 block 索引（从 0 开始），返回 blockName
		 * - 默认: 生成 `block-${blockIndex + 1}`
		 */
		fallback?: string | ((blockIndex: number) => string);
	};
	/** 渐进式定位：处理完当前批次后检查新增，直到没有新增为止。默认 true */
	progressive?: boolean;
}

/**
 * 遍历 blocks 并执行处理逻辑，自动获取 blockName
 * @param blocksLocator - blocks 的 Locator
 * @param handler - 处理函数，接收 block 和 blockName
 * @param options - 可选配置
 */
export async function forEachBlock(
	blocksLocator: Locator,
	handler: (block: Locator, blockName: string | null) => Promise<void>,
	options?: ForEachBlockOptions,
) {
	const { blockName = {}, progressive = true } = options ?? {};
	const { locator: blockNameLocator, timeout = 1000, fallback } = blockName;

	// 获取文本内容的辅助函数（带重试和滚动）
	const getTextWithRetry = (
		locator: Locator,
		block: Locator,
	): Promise<string | null> =>
		retryOnce(
			() => locator.textContent({ timeout }),
			() =>
				block.evaluate((el) =>
					el.scrollIntoView({ behavior: "auto", block: "start" }),
				),
		);

	// 获取 blockName 的辅助函数
	const getBlockName = async (block: Locator, blockIndex: number) => {
		// 如果提供了 locator，直接使用
		if (blockNameLocator) {
			return getTextWithRetry(blockNameLocator, block);
		}

		// 未提供 locator，先快速检查 heading 是否存在
		const headingLocator = block.getByRole("heading");
		const headingCount = await headingLocator.count();

		if (headingCount > 0) {
			// 存在 heading，继续获取 blockName
			return getTextWithRetry(headingLocator, block);
		}

		// 不存在 heading，使用 fallback
		if (fallback) {
			return typeof fallback === "string"
				? `${fallback}-${blockIndex + 1}`
				: fallback(blockIndex);
		}

		// fallback 也没提供，使用默认格式 block-N
		return `block-${blockIndex + 1}`;
	};

	if (!progressive) {
		// 只定位一次
		const blocks = await blocksLocator.all();
		for (let i = 0; i < blocks.length; i++) {
			const block = blocks[i];
			const blockName = await getBlockName(block, i);
			await handler(block, blockName);
		}
	} else {
		// 渐进式定位：处理完当前批次后，检查是否有新增
		let processedCount = 0;
		while (true) {
			const allBlocks = await blocksLocator.all();
			const newBlocks = allBlocks.slice(processedCount);
			if (newBlocks.length === 0) break;

			console.log(
				`发现 ${newBlocks.length} 个新 block，总计 ${allBlocks.length}`,
			);
			for (let i = 0; i < newBlocks.length; i++) {
				const block = newBlocks[i];
				const blockIndex = processedCount + i;
				const blockName = await getBlockName(block, blockIndex);
				await handler(block, blockName);
			}
			processedCount = allBlocks.length;
		}
	}
}
