import { toJsonObject } from "curlconverter";
import fse from "fs-extra";
import path from "path";
import { type ParsedCurl } from "./types";

/** 构建请求 URL（替换最后一段为 blockName） */
export function buildUrl(baseUrl: string, blockName: string): string {
	const urlParts = baseUrl.split("/");
	urlParts[urlParts.length - 1] = blockName;
	return urlParts.join("/");
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

/** 获取 cURL 文件路径 */
export function getCurlPath(domain: string): string {
	return path.join(".crawler", domain, "request.bash");
}
