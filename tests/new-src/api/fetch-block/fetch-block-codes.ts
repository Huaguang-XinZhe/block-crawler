import { fetchBlocksConcurrently } from "./internal/fetch-blocks-concurrently";
import { refreshAuthorization } from "./internal/refresh-authorization";
import type { FetchOptions, OutputOptions } from "./types";
import { parseCurlFile } from "./utils";

/**
 * 并发请求获取代码
 * @param blockNames - block 名称列表
 * @param domain - 域名，如 www.shadcnblocks.com
 * @param codePath - 响应中代码字段的路径，如 files[0].content
 * @param options - 可选配置
 */
export async function fetchBlockCodes(
	blockNames: string[],
	domain: string,
	codePath: string,
	options?: FetchOptions,
): Promise<void> {
	if (blockNames.length === 0) {
		console.log("没有 blockNames 需要获取");
		return;
	}

	const { concurrency = 20, limit = 0, output = {} } = options ?? {};

	const outputOptions: OutputOptions = {
		groupBlocks: output.groupBlocks ?? true,
		groupDirCapitalize: output.groupDirCapitalize ?? false,
		fileCapitalize: output.fileCapitalize ?? false,
		extension: output.extension ?? "tsx",
		newBlocks: output.newBlocks ?? false,
	};

	// 解析 cURL 文件
	let parsed = await parseCurlFile(domain);

	// 刷新授权（内置开启，请求第一个 block 并保存）
	parsed = await refreshAuthorization(
		parsed,
		domain,
		blockNames[0],
		codePath,
		outputOptions,
	);

	// 上一步可能会报错，如果报错，就不会继续❗

	// 并发请求剩余 blocks
	const pendingBlocks =
		limit > 0 ? blockNames.slice(1, limit) : blockNames.slice(1);
	const { success, failed, errors } = await fetchBlocksConcurrently(
		pendingBlocks,
		parsed,
		domain,
		codePath,
		concurrency,
		outputOptions,
	);

	const totalSuccess = 1 + success; // 第一个已成功

	// 打印结果摘要
	console.log("\n=== 结果 ===");
	console.log(`成功: ${totalSuccess}`);
	console.log(`失败: ${failed}`);

	if (errors.length > 0) {
		console.log("\n失败详情:");
		for (const { blockName, error } of errors) {
			console.log(`  - ${blockName}: ${error}`);
		}
	}
}
