import { cookiesToString } from "../../shared/utils";
import { buildUrl, parseCurlFile } from "./utils";

/**
 * 发送单个请求并返回完整响应信息（用于调试）
 */
export async function fetchBlockDebug(
	domain: string,
	blockName: string,
): Promise<{
	status: number;
	rawHeaders: [string, string][];
	setCookies: string[];
	data: unknown;
}> {
	const parsed = await parseCurlFile(domain);
	const url = buildUrl(parsed.url, blockName);
	const headers = {
		...parsed.headers,
		Cookie: cookiesToString(parsed.cookies),
	};

	const response = await fetch(url, {
		method: parsed.method.toUpperCase(),
		headers,
	});

	// 收集原始响应头
	const rawHeaders: [string, string][] = [];
	response.headers.forEach((value, key) => {
		rawHeaders.push([key, value]);
	});

	// 直接获取 Set-Cookie 数组
	const setCookies = response.headers.getSetCookie();

	const data = await response.json();

	return {
		status: response.status,
		rawHeaders,
		setCookies,
		data,
	};
}
