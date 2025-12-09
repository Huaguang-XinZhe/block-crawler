/**
 * 新区块拉取器
 *
 * 自动从 changelog 页面获取新区块列表并拉取代码
 */

import type { Page, Locator } from "@playwright/test";
import { fetchBlockCodes, type FetchOptions } from "./curl-fetcher";

// ===================== 类型定义 =====================

export interface NewBlocksFetcherOptions {
  /** 域名，如 www.shadcnblocks.com */
  domain: string;
  /** new blocks 区块定位器 */
  newBlocksLocator: Locator;
  /** 代码字段在响应体中的路径，如 "code" 或 "files[0].content" */
  codePath: string;
  /** changelog 页路径，默认 "changelog" */
  changelogPath?: string;
  /** 其他 fetch 选项 */
  fetchOptions?: Omit<FetchOptions, "output"> & {
    output?: Omit<FetchOptions["output"], "newBlocks">;
  };
}

// ===================== 内部工具 =====================

/** 获取链接文本列表 */
async function getLinkTexts(links: Locator[]): Promise<string[]> {
  const tasks = links.map(async (link) => {
    const text = await link.textContent();
    return text;
  });
  const texts = await Promise.all(tasks);
  return texts.filter((text): text is string => text !== null);
}

// ===================== 主入口 =====================

/**
 * 拉取新区块代码
 *
 * @param page - Playwright Page 对象
 * @param options - 配置选项
 *
 * @example
 * ```ts
 * await fetchNewBlocks(page, {
 *   domain: "www.shadcnblocks.com",
 *   newBlocksLocator: page.locator('//div[@id="section-2"]/div/div[2]/div/div/div'),
 *   codePath: "code",
 * });
 * ```
 */
export async function fetchNewBlocks(
  page: Page,
  options: NewBlocksFetcherOptions
): Promise<void> {
  const {
    domain,
    newBlocksLocator,
    codePath,
    changelogPath = "changelog",
    fetchOptions = {},
  } = options;

  // 访问 changelog 页
  await page.goto(`https://${domain}/${changelogPath}`);

  // 获取区块内所有的链接
  const links = await newBlocksLocator.getByRole("link").all();
  const newBlockNames = await getLinkTexts(links);

  if (newBlockNames.length === 0) {
    console.log("⚠️ 没有发现新区块");
    return;
  } else {
    console.log(`📦 发现 ${newBlockNames.length} 个新区块`);
  }

  // 并发获取 block 的代码
  await fetchBlockCodes(newBlockNames, domain, codePath, {
    ...fetchOptions,
    output: {
      ...fetchOptions.output,
      newBlocks: true,
    },
  });
}
