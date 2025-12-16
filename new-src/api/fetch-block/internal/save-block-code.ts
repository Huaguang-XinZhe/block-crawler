import fse from "fs-extra";
import path from "path";
import { capitalize, getValueByPath } from "../../../shared/utils";
import type { OutputOptions } from "../types";

/** 保存代码到文件 */
export async function saveBlockCode(
	domain: string,
	blockName: string,
	data: unknown,
	codePath: string,
	outputOptions: OutputOptions,
): Promise<void> {
	const code = getValueByPath(data, codePath);

	if (typeof code !== "string") {
		throw new Error(`无法从响应中提取代码，路径: ${codePath}`);
	}

	const outputPath = getOutputPath(domain, blockName, outputOptions);
	await fse.outputFile(outputPath, code);
}

/** 获取输出文件路径 */
function getOutputPath(
	domain: string,
	blockName: string,
	options: OutputOptions,
): string {
	const {
		extension,
		groupBlocks,
		groupDirCapitalize,
		fileCapitalize,
		newBlocks,
	} = options;
	const outputDomain = newBlocks ? `${domain}.new` : domain;
	const baseDir = path.join("output", outputDomain);
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

/** 从 blockName 中提取组名（去除末尾数字及可能的字母后缀，如 15a, 15b） */
function extractGroupName(blockName: string): string {
	return blockName.replace(/\d+[a-zA-Z]*$/, "");
}

/** 转换文件名：首字母大写，英文和数字之间加空格 */
function formatFileName(name: string): string {
	const spaced = name.replace(/([a-zA-Z])(\d)/g, "$1 $2");
	return capitalize(spaced);
}
