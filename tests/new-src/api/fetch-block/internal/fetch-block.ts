import { cookiesToString } from "../../../shared/utils";
import type { ParsedCurl } from "../types";
import { buildUrl } from "../utils";

/** 发送单个请求获取数据 */
export async function fetchBlock(
	parsed: ParsedCurl,
	blockName: string,
	// 是否抛出错误，默认为 true
	throwError: boolean = true,
): Promise<{ data: unknown; setCookies: string[] }> {
	const url = buildUrl(parsed.url, blockName);
	const headers = {
		...parsed.headers,
		Cookie: cookiesToString(parsed.cookies),
	};

	const response = await fetch(url, {
		method: parsed.method.toUpperCase(),
		headers,
	});

	if (!response.ok && throwError) {
		throw new Error(`请求失败: ${response.status} ${response.statusText}`);
	}

	// 不抛出错误的话，还是会获取 data 和 setCookies❗

	const data = await response.json();
	const setCookies = response.headers.getSetCookie();

	return { data, setCookies };
}
