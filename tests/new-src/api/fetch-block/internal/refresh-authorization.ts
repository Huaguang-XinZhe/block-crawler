import fse from "fs-extra";
import { cookiesToString } from "../../../shared/utils";
import type { OutputOptions, ParsedCurl } from "../types";
import { getCurlPath } from "../utils";
import { fetchBlock } from "./fetch-block";
import { saveBlockCode } from "./save-block-code";

// Cookie 格式正则：-b/--cookie 或 -H 'Cookie: ...'
const COOKIE_PATTERNS = {
	// -b 'cookies' 或 --cookie 'cookies'
	shortFlag: /-b\s+['"]([^'"]*)['"]/,
	// -H 'Cookie: cookies'
	header: /-H\s+['"]Cookie:\s*[^'"]*['"]/,
};

/** 刷新授权：请求第一个 block，更新 cookies */
export async function refreshAuthorization(
	parsed: ParsedCurl,
	domain: string,
	firstBlock: string,
	codePath: string,
	outputOptions: OutputOptions,
): Promise<ParsedCurl> {
	console.log(`🔄 刷新授权中（请求 ${firstBlock}）...`);

	const { data, setCookies } = await fetchBlock(parsed, firstBlock, false);

	// 解析并验证 Set-Cookie（会在 deleted 时抛出错误）
	const newCookies = parseAndValidateSetCookies(setCookies, parsed.cookies);

	// 检查是否有更新
	const hasUpdates =
		JSON.stringify(newCookies) !== JSON.stringify(parsed.cookies);

	if (hasUpdates) {
		parsed.cookies = newCookies;
		await updateCurlCookies(domain, newCookies);
		console.log("✅ 授权已刷新并持久化");
	}

	// 保存第一个 block 的代码
	await saveBlockCode(domain, firstBlock, data, codePath, outputOptions);
	console.log(`✓ ${firstBlock}`);

	return parsed;
}

/** 更新 cURL 文件中的 cookies */
async function updateCurlCookies(
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
 * 解析 Set-Cookie 数组并检查是否有 deleted 的 cookie
 * @throws 如果有 cookie 值为 "deleted"，抛出错误
 */
function parseAndValidateSetCookies(
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
