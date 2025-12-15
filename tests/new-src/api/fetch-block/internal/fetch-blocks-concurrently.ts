import pLimit from "p-limit";
import type { FetchResult, OutputOptions, ParsedCurl } from "../types";
import { fetchBlock } from "./fetch-block";
import { saveBlockCode } from "./save-block-code";

/** 并发请求 blocks */
export async function fetchBlocksConcurrently(
	blocks: string[],
	parsed: ParsedCurl,
	domain: string,
	codePath: string,
	concurrency: number,
	outputOptions: OutputOptions,
): Promise<FetchResult> {
	const limit = pLimit(concurrency);

	let success = 0;
	let failed = 0;
	const errors: FetchResult["errors"] = [];

	const tasks = blocks.map((blockName) =>
		limit(async () => {
			try {
				const { data } = await fetchBlock(parsed, blockName);
				await saveBlockCode(domain, blockName, data, codePath, outputOptions);
				success++;
				console.log(`✓ ${blockName}`);
			} catch (err) {
				failed++;
				const errorMsg = err instanceof Error ? err.message : String(err);
				errors.push({ blockName, error: errorMsg });
				console.error(`✗ ${blockName}: ${errorMsg}`);
			}
		}),
	);

	await Promise.all(tasks);

	return { success, failed, errors };
}
