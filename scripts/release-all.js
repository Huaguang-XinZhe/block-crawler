#!/usr/bin/env node

/**
 * 自动化发布流程脚本
 * 
 * 执行步骤：
 * 1. 执行 pnpm changeset version 更新版本号
 * 2. 执行 pnpm release 发布到 npm
 * 3. 执行 pnpm update block-crawler 更新依赖
 * 4. 进行 git 提交（不推送到远程）
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

function exec(command, options = {}) {
  console.log(`\n📍 执行: ${command}\n`);
  try {
    execSync(command, {
      cwd: rootDir,
      stdio: 'inherit',
      ...options
    });
  } catch (error) {
    console.error(`\n❌ 命令执行失败: ${command}`);
    process.exit(1);
  }
}

function getPackageVersion() {
  const packageJson = JSON.parse(
    readFileSync(join(rootDir, 'package.json'), 'utf-8')
  );
  return packageJson.version;
}

console.log('🚀 开始自动化发布流程...\n');

// 步骤 1: 更新版本号
console.log('📦 步骤 1: 更新版本号');
exec('pnpm changeset version');

// 获取新版本号
const newVersion = getPackageVersion();
console.log(`\n✅ 版本已更新到: ${newVersion}`);

// 步骤 2: 发布到 npm
console.log('\n📤 步骤 2: 发布到 npm');
exec('pnpm release');

// 步骤 3: 更新依赖
console.log('\n🔄 步骤 3: 更新 block-crawler 依赖');
exec('pnpm update block-crawler');

// 步骤 4: Git 提交
console.log('\n💾 步骤 4: Git 提交');
exec('git add -A');
exec(`git commit -m "chore: release version ${newVersion}\n\n- chore: 应用 changesets 更新版本号到 ${newVersion}\n- docs: 更新 CHANGELOG.md\n- chore: 更新 devDependencies 中的 block-crawler 到 ${newVersion}\n- chore: 删除已应用的 changeset 文件"`);

console.log('\n🎉 发布流程完成！');
console.log(`\n📊 版本: ${newVersion}`);
console.log('⚠️  注意: 代码已提交到本地，未推送到远程');
console.log('\n如需推送到远程，请手动执行: git push');

