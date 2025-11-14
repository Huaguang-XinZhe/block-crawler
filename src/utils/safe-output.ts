import fse from "fs-extra";
import { sanitizeFilename } from "./sanitize-filename";
import path from "path";

/**
 * SafeOutput 函数类型
 */
export type SafeOutput = (data: string, filePath?: string) => Promise<void>;

/**
 * 创建 safeOutput 函数
 * 
 * @param mode 模式：'block' | 'test' | 'page'
 * @param outputDir 输出目录
 * @param blockPath Block 模式下的 blockPath（可选）
 * @param blockName Test 模式下的 blockName（可选）
 * @returns safeOutput 函数
 */
export function createSafeOutput(
  mode: 'block' | 'test' | 'page',
  outputDir: string,
  blockPath?: string,
  blockName?: string
): SafeOutput {
  return async (data: string, filePath?: string): Promise<void> => {
    let finalPath: string;

    if (filePath) {
      // 用户提供了路径，需要 sanitize
      finalPath = sanitizePath(filePath);
    } else {
      // 使用默认路径
      switch (mode) {
        case 'block':
          if (!blockPath) {
            throw new Error('Block 模式下必须提供 blockPath 或显式传入 filePath');
          }
          // blockPath 可能包含路径分隔符，需要 sanitize 整个路径
          const sanitizedBlockPath = sanitizePath(`${blockPath}.tsx`);
          finalPath = path.join(outputDir, sanitizedBlockPath);
          break;
        case 'test':
          if (!blockName) {
            throw new Error('Test 模式下必须提供 blockName 或显式传入 filePath');
          }
          // blockName 需要 sanitize
          const sanitizedTestFilename = sanitizeFilename(`test-${blockName}.tsx`);
          finalPath = path.join(outputDir, sanitizedTestFilename);
          break;
        case 'page':
          throw new Error('Page 模式下必须显式传入 filePath');
        default:
          throw new Error(`未知模式: ${mode}`);
      }
    }

    // 确保目录存在
    await fse.ensureDir(path.dirname(finalPath));
    
    // 写入文件
    await fse.outputFile(finalPath, data);
  };
}

/**
 * 清理路径中的非法字符
 * 处理路径中的每个部分（目录名和文件名）
 * 
 * @param filePath 文件路径（可以是相对路径或绝对路径）
 * @returns 清理后的路径
 */
function sanitizePath(filePath: string): string {
  // 标准化路径（处理 .. 和 . 等）
  const normalized = path.normalize(filePath);
  
  // 分离目录和文件名
  const dir = path.dirname(normalized);
  const filename = path.basename(normalized);
  
  // 清理文件名
  const sanitizedFilename = sanitizeFilename(filename);
  
  // 如果目录是根目录或当前目录，直接返回清理后的文件名
  if (dir === '.' || dir === path.sep) {
    return sanitizedFilename;
  }
  
  // 清理目录路径的每个部分
  const dirParts = dir.split(path.sep).filter(part => part !== '');
  const sanitizedDirParts = dirParts.map(part => sanitizeFilename(part));
  
  // 重新组合路径
  if (path.isAbsolute(normalized)) {
    // 绝对路径：保留根分隔符
    return path.sep + path.join(...sanitizedDirParts, sanitizedFilename);
  } else {
    // 相对路径
    return path.join(...sanitizedDirParts, sanitizedFilename);
  }
}

