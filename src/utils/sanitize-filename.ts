/**
 * 清理文件名，移除或替换非法字符
 * 确保文件名在所有操作系统上都能正常使用
 * 
 * @param filename 原始文件名
 * @returns 清理后的文件名
 */
export function sanitizeFilename(filename: string): string {
  // Windows 和 Unix 系统都不允许的字符：< > : " / \ | ? *
  // 同时移除控制字符（ASCII 0-31）和删除字符（127）
  // 替换空格为下划线（可选，但更安全）
  
  return filename
    // 移除或替换非法字符
    .replace(/[<>:"/\\|?*\x00-\x1F\x7F]/g, '')
    // 替换连续的点为单个点（但保留最后一个扩展名的点）
    .replace(/\.{2,}/g, '.')
    // 移除开头和结尾的点或空格
    .replace(/^[\s.]+|[\s.]+$/g, '')
    // 替换空格为下划线（可选，但更安全）
    .replace(/\s+/g, '_')
    // 限制长度（Windows 路径限制 260 字符，但文件名部分通常更短）
    // 保留 200 字符应该足够
    .slice(0, 200)
    // 如果清理后为空，使用默认名称
    || 'unnamed';
}

