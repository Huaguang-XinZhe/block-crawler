/**
 * 并发获取 block 代码
 *
 * 用法：
 * 1. 从浏览器导出 cURL（bash），放到 .crawler/{域名}/request.bash
 * 2. 调用 fetchBlockCodes(blockNames, domain, codePath, options?)
 */

import fse from "fs-extra";
import pLimit from "p-limit";
import path from "path";
import { getValueByPath, cookiesToString, capitalize } from "./utils";
import {
  parseCurlFile,
  updateCurlCookies,
  parseAndValidateSetCookies,
  buildUrl,
  ParsedCurl,
} from "./curl-parser";

const OUTPUT_DIR = "output";

// ===================== 类型定义 =====================

export interface OutputOptions {
  /** 是否归集 block，默认 true */
  groupBlocks: boolean;
  /** 归集目录名称首字母大写，默认 false */
  groupDirCapitalize: boolean;
  /** 文件名首字母大写，且英文和数字之间用空格分隔（如 Hero 12），默认 false */
  fileCapitalize: boolean;
  /** 组件名称后缀，默认 tsx */
  extension: string;
  /** 是否是新 blocks，默认 false */
  newBlocks: boolean;
}

export interface FetchOptions {
  /** 并发数，默认 20 */
  concurrency?: number;
  /** 仅测试前 n 个 block，默认 0（不限制） */
  limit?: number;
  /** 输出配置 */
  output?: Partial<OutputOptions>;
}

export interface FetchResult {
  success: number;
  failed: number;
  errors: Array<{ blockName: string; error: string }>;
}

// ===================== 内部工具 =====================

/** 从 blockName 中提取组名（去除末尾数字及可能的字母后缀，如 15a, 15b） */
function extractGroupName(blockName: string): string {
  return blockName.replace(/\d+[a-zA-Z]*$/, "");
}

/** 转换文件名：首字母大写，英文和数字之间加空格 */
function formatFileName(name: string): string {
  const spaced = name.replace(/([a-zA-Z])(\d)/g, "$1 $2");
  return capitalize(spaced);
}

/** 获取输出文件路径 */
function getOutputPath(
  domain: string,
  blockName: string,
  options: OutputOptions
): string {
  const {
    extension,
    groupBlocks,
    groupDirCapitalize,
    fileCapitalize,
    newBlocks,
  } = options;
  const outputDomain = newBlocks ? `${domain}.new` : domain;
  const baseDir = path.join(OUTPUT_DIR, outputDomain);
  const fileName = fileCapitalize ? formatFileName(blockName) : blockName;

  if (groupBlocks) {
    let groupName = extractGroupName(blockName);
    if (groupDirCapitalize) {
      groupName = capitalize(groupName);
    }
    return path.join(baseDir, groupName, `${fileName}.${extension}`);
  }

  return path.join(baseDir, `${fileName}.${extension}`);
}

// ===================== 请求函数 =====================

/** 发送单个请求获取数据 */
async function fetchBlock(
  parsed: ParsedCurl,
  blockName: string,
  // 是否抛出错误，默认为 true
  throwError: boolean = true
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

/** 保存代码到文件 */
async function saveBlockCode(
  domain: string,
  blockName: string,
  data: unknown,
  codePath: string,
  outputOptions: OutputOptions
): Promise<void> {
  const code = getValueByPath(data, codePath);

  if (typeof code !== "string") {
    throw new Error(`无法从响应中提取代码，路径: ${codePath}`);
  }

  const outputPath = getOutputPath(domain, blockName, outputOptions);
  await fse.outputFile(outputPath, code);
}

/** 刷新授权：请求第一个 block，更新 cookies */
async function refreshAuthorization(
  parsed: ParsedCurl,
  domain: string,
  firstBlock: string,
  codePath: string,
  outputOptions: OutputOptions
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

/** 并发请求 blocks */
async function fetchBlocksConcurrently(
  blocks: string[],
  parsed: ParsedCurl,
  domain: string,
  codePath: string,
  concurrency: number,
  outputOptions: OutputOptions
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
    })
  );

  await Promise.all(tasks);

  return { success, failed, errors };
}

// ===================== 主入口 =====================

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
  options?: FetchOptions
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
    outputOptions
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
    outputOptions
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

// ===================== 调试函数 =====================

/**
 * 发送单个请求并返回完整响应信息（用于调试）
 */
export async function fetchBlockDebug(
  domain: string,
  blockName: string
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
