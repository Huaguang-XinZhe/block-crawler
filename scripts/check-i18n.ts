/**
 * 检查未国际化的日志脚本
 * 
 * 功能：
 * 1. 扫描所有源代码文件中的 console.log/error/warn
 * 2. 检测是否包含中文字符（表示可能未国际化）
 * 3. 生成报告
 */

import * as fs from 'fs';
import * as path from 'path';

interface LogEntry {
  file: string;
  line: number;
  type: 'log' | 'error' | 'warn';
  content: string;
  hasChinese: boolean;
  usesI18n: boolean;
}

const SRC_DIR = path.join(process.cwd(), 'src');
const results: LogEntry[] = [];

/**
 * 检测字符串是否包含中文
 */
function hasChinese(str: string): boolean {
  return /[\u4e00-\u9fa5]/.test(str);
}

/**
 * 检测是否使用了 i18n
 */
function usesI18n(str: string): boolean {
  return /i18n\.t\(/.test(str);
}

/**
 * 递归扫描目录
 */
function scanDirectory(dir: string): void {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      scanDirectory(fullPath);
    } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
      scanFile(fullPath);
    }
  }
}

/**
 * 检测行是否在注释中
 */
function isInComment(line: string, trimmedLine: string): boolean {
  // 单行注释
  if (trimmedLine.startsWith('//')) {
    return true;
  }
  
  // 多行注释开始
  if (trimmedLine.startsWith('/*') || trimmedLine.startsWith('*')) {
    return true;
  }
  
  return false;
}

/**
 * 扫描单个文件
 */
function scanFile(filePath: string): void {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  // 匹配 console.log/error/warn
  const consoleRegex = /console\.(log|error|warn)\((.*)\)/;
  
  let inMultiLineComment = false;
  
  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    
    // 检查多行注释状态
    if (trimmedLine.includes('/*')) {
      inMultiLineComment = true;
    }
    if (trimmedLine.includes('*/')) {
      inMultiLineComment = false;
      return; // 跳过多行注释的结束行
    }
    
    // 跳过注释行
    if (inMultiLineComment || isInComment(line, trimmedLine)) {
      return;
    }
    
    const match = line.match(consoleRegex);
    if (match) {
      const type = match[1] as 'log' | 'error' | 'warn';
      const logContent = match[2] || '';
      
      results.push({
        file: path.relative(process.cwd(), filePath),
        line: index + 1,
        type,
        content: line.trim(),
        hasChinese: hasChinese(logContent),
        usesI18n: usesI18n(logContent),
      });
    }
  });
}

/**
 * 生成报告
 */
function generateReport(): void {
  console.log('\n========================================');
  console.log('🔍 国际化检查报告');
  console.log('========================================\n');
  
  const totalLogs = results.length;
  const chineseLogs = results.filter(r => r.hasChinese);
  const i18nLogs = results.filter(r => r.usesI18n);
  const needI18n = chineseLogs.filter(r => !r.usesI18n);
  
  console.log(`📊 统计信息:`);
  console.log(`   - 总日志数: ${totalLogs}`);
  console.log(`   - 包含中文: ${chineseLogs.length}`);
  console.log(`   - 已使用 i18n: ${i18nLogs.length}`);
  console.log(`   - 需要国际化: ${needI18n.length}`);
  console.log();
  
  if (needI18n.length > 0) {
    console.log('⚠️  以下日志需要国际化:\n');
    
    // 按文件分组
    const byFile = needI18n.reduce((acc, entry) => {
      if (!acc[entry.file]) {
        acc[entry.file] = [];
      }
      acc[entry.file].push(entry);
      return acc;
    }, {} as Record<string, LogEntry[]>);
    
    Object.entries(byFile).forEach(([file, entries]) => {
      console.log(`📄 ${file}`);
      entries.forEach(entry => {
        console.log(`   L${entry.line}: ${entry.content}`);
      });
      console.log();
    });
  }
  
  // 按文件统计
  console.log('\n📈 按文件统计:\n');
  const fileStats = results.reduce((acc, entry) => {
    if (!acc[entry.file]) {
      acc[entry.file] = { total: 0, needI18n: 0 };
    }
    acc[entry.file].total++;
    // 只统计包含中文但未使用i18n的（真正需要处理的）
    if (entry.hasChinese && !entry.usesI18n) {
      acc[entry.file].needI18n++;
    }
    return acc;
  }, {} as Record<string, { total: number; needI18n: number }>);
  
  Object.entries(fileStats)
    .sort((a, b) => b[1].needI18n - a[1].needI18n)
    .forEach(([file, stats]) => {
      const status = stats.needI18n === 0 ? '✅' : '⚠️ ';
      console.log(`${status} ${file}`);
      console.log(`   总日志: ${stats.total}, 待国际化: ${stats.needI18n}`);
    });
  
  console.log('\n========================================\n');
}

// 执行扫描
scanDirectory(SRC_DIR);
generateReport();

