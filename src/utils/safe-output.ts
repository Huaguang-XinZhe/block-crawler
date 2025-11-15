import fse from "fs-extra";
import { sanitizeFilename, sanitizeFilenameWithOriginal } from "./sanitize-filename";
import path from "path";
import type { FilenameMappingManager } from "./filename-mapping";

/**
 * SafeOutput 函数类型
 */
export type SafeOutput = (data: string, filePath?: string) => Promise<void>;

/**
 * 创建 safeOutput 函数
 * 
 * @param mode 模式：'block' | 'test' | 'page'
 * @param outputDir 输出目录
 * @param mappingManager 文件名映射管理器（可选）
 * @param blockPath Block 模式下的 blockPath（可选）
 * @param blockName Test 模式下的 blockName（可选）
 * @returns safeOutput 函数
 */
export function createSafeOutput(
  mode: 'block' | 'test' | 'page',
  outputDir: string,
  mappingManager?: FilenameMappingManager,
  blockPath?: string,
  blockName?: string
): SafeOutput {
  return async (data: string, filePath?: string): Promise<void> => {
    let finalPath: string;
    let originalFilename: string | undefined;
    let sanitizedFilename: string | undefined;

    if (filePath) {
      // 用户提供了路径，需要 sanitize
      const result = sanitizePathWithMapping(filePath, mappingManager);
      // 用户提供的路径是相对于 outputDir 的
      finalPath = path.join(outputDir, result.sanitizedPath);
      originalFilename = result.originalFilename;
      sanitizedFilename = result.sanitizedFilename;
    } else {
      // 使用默认路径
      switch (mode) {
        case 'block':
          if (!blockPath) {
            throw new Error('Block 模式下必须提供 blockPath 或显式传入 filePath');
          }
          // blockPath 可能包含路径分隔符，需要 sanitize 整个路径
          // sanitizePathWithMapping 会自动记录映射
          const originalBlockPath = `${blockPath}.tsx`;
          const result = sanitizePathWithMapping(originalBlockPath, mappingManager);
          finalPath = path.join(outputDir, result.sanitizedPath);
          originalFilename = result.originalFilename;
          sanitizedFilename = result.sanitizedFilename;
          break;
        case 'test':
          if (!blockName) {
            throw new Error('Test 模式下必须提供 blockName 或显式传入 filePath');
          }
          // blockName 需要 sanitize
          const originalTestFilename = `test-${blockName}.tsx`;
          const testResult = sanitizeFilenameWithOriginal(originalTestFilename);
          sanitizedFilename = testResult.sanitized;
          originalFilename = testResult.original;
          if (mappingManager && testResult.changed) {
            mappingManager.record(originalFilename, sanitizedFilename);
          }
          finalPath = path.join(outputDir, sanitizedFilename);
          break;
        case 'page':
          throw new Error('Page 模式下必须显式传入 filePath');
        default:
          throw new Error(`未知模式: ${mode}`);
      }
    }
    
    // 写入文件
    await fse.outputFile(finalPath, data);
  };
}

/**
 * 清理路径并记录文件名映射
 * 
 * @param filePath 文件路径（可以是相对路径或绝对路径）
 * @param mappingManager 文件名映射管理器（可选）
 * @returns 清理后的路径和文件名信息
 */
function sanitizePathWithMapping(
  filePath: string,
  mappingManager?: FilenameMappingManager
): {
  sanitizedPath: string;
  originalFilename: string;
  sanitizedFilename: string;
} {
  // 标准化路径（处理 .. 和 . 等）
  const normalized = path.normalize(filePath);
  
  // 分离目录和文件名
  const dir = path.dirname(normalized);
  const originalFilename = path.basename(normalized);
  
  // 清理文件名
  const filenameResult = sanitizeFilenameWithOriginal(originalFilename);
  const sanitizedFilename = filenameResult.sanitized;
  
  // 如果目录是根目录或当前目录，直接返回清理后的文件名
  if (dir === '.' || dir === path.sep) {
    // 记录文件名映射（如果发生变化）
    if (mappingManager && filenameResult.changed) {
      mappingManager.record(originalFilename, sanitizedFilename);
    }
    return {
      sanitizedPath: sanitizedFilename,
      originalFilename,
      sanitizedFilename,
    };
  }
  
  // 清理目录路径的每个部分
  const dirParts = dir.split(path.sep).filter(part => part !== '');
  const sanitizedDirParts = dirParts.map(part => sanitizeFilename(part));
  
  // 重新组合路径
  let sanitizedPath: string;
  if (path.isAbsolute(normalized)) {
    // 绝对路径：保留根分隔符
    sanitizedPath = path.sep + path.join(...sanitizedDirParts, sanitizedFilename);
  } else {
    // 相对路径
    sanitizedPath = path.join(...sanitizedDirParts, sanitizedFilename);
  }
  
  // 记录完整路径的映射（如果发生变化）
  // 注意：这里记录的是完整路径的映射，而不仅仅是文件名
  if (mappingManager && normalized !== sanitizedPath) {
    mappingManager.record(normalized, sanitizedPath);
  }
  
  return {
    sanitizedPath,
    originalFilename,
    sanitizedFilename,
  };
}

