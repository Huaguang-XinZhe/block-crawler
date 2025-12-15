/**
 * cURL 解析和 cookies 管理
 */

import { toJsonObject } from "curlconverter";
import fse from "fs-extra";
import path from "path";
import { cookiesToString } from "./utils";

const CRAWLER_DIR = ".crawler";

// Cookie 格式正则：-b/--cookie 或 -H 'Cookie: ...'
const COOKIE_PATTERNS = {
	// -b 'cookies' 或 --cookie 'cookies'
	shortFlag: /-b\s+['"]([^'"]*)['"]/,
	// -H 'Cookie: cookies'
	header: /-H\s+['"]Cookie:\s*[^'"]*['"]/,
};

export interface ParsedCurl {
	url: string;
	method: string;
	headers: Record<string, string>;
	cookies: Record<string, string>;
}

/** 获取 cURL 文件路径 */
function getCurlPath(domain: string): string {
	return path.join(CRAWLER_DIR, domain, "request.bash");
}

/** 解析 cURL 命令文件 */
export async function parseCurlFile(domain: string): Promise<ParsedCurl> {
	const curlPath = getCurlPath(domain);
	const curlCommand = await fse.readFile(curlPath, "utf-8");
	const parsed = toJsonObject(curlCommand);

	return {
		url: parsed.url as string,
		method: (parsed.method as string) || "GET",
		headers: (parsed.headers as Record<string, string>) || {},
		cookies: (parsed.cookies as Record<string, string>) || {},
	};
}

/** 更新 cURL 文件中的 cookies */
export async function updateCurlCookies(
	domain: string,
	newCookies: Record<string, string>,
): Promise<void> {
	const curlPath = getCurlPath(domain);
	let curlCommand = await fse.readFile(curlPath, "utf-8");
	const cookieStr = cookiesToString(newCookies);

	if (COOKIE_PATTERNS.shortFlag.test(curlCommand)) {
		curlCommand = curlCommand.replace(
			COOKIE_PATTERNS.shortFlag,
			`-b '${cookieStr}'`,
		);
	} else {
		curlCommand = curlCommand.replace(
			COOKIE_PATTERNS.header,
			`-H 'Cookie: ${cookieStr}'`,
		);
	}

	await fse.writeFile(curlPath, curlCommand, "utf-8");
}

/**
 * 从 Set-Cookie 字符串中提取 cookie 名和值
 */
function parseSingleCookie(
	setCookie: string,
): { name: string; value: string } | null {
	const match = setCookie.match(/^([^=]+)=([^;]*)/);
	if (match) {
		return { name: match[1], value: match[2] };
	}
	return null;
}

/**
 * 解析 Set-Cookie 数组并检查是否有 deleted 的 cookie
 * @throws 如果有 cookie 值为 "deleted"，抛出错误
 */
export function parseAndValidateSetCookies(
	setCookies: string[],
	existingCookies: Record<string, string>,
): Record<string, string> {
	if (setCookies.length === 0) {
		return existingCookies;
	}

	const deletedCookies: string[] = [];
	const newCookies = { ...existingCookies };

	for (const setCookie of setCookies) {
		const parsed = parseSingleCookie(setCookie);
		if (parsed) {
			if (parsed.value === "deleted") {
				deletedCookies.push(parsed.name);
			} else {
				newCookies[parsed.name] = parsed.value;
			}
		}
	}

	if (deletedCookies.length > 0) {
		throw new Error(
			`❌ 授权已过期！服务器返回了 deleted cookies: ${deletedCookies.join(", ")}\n` +
				`   请手动更新 cURL 文件中的这些 cookies。`,
		);
	}

	return newCookies;
}

/** 构建请求 URL（替换最后一段为 blockName） */
export function buildUrl(baseUrl: string, blockName: string): string {
	const urlParts = baseUrl.split("/");
	urlParts[urlParts.length - 1] = blockName;
	return urlParts.join("/");
}
