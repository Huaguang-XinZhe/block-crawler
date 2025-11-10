import { ProgressManager } from "./utils/progress-manager";

/**
 * 测试 Ora 进度管理器
 * 运行: npx tsx tests/test_ora-progress.ts
 */
async function testProgressManager() {
  const progress = new ProgressManager();
  const total = 20;

  progress.start(total, "开始测试进度管理器...");

  // 模拟处理任务
  for (let i = 0; i < total; i++) {
    // 模拟异步任务
    await new Promise((resolve) => setTimeout(resolve, 200));
    
    const taskName = `task-${i + 1}`;
    progress.update(taskName);
  }

  progress.succeed();
  console.log("\n✅ 测试完成！");
}

testProgressManager().catch((error) => {
  console.error("❌ 测试失败:", error);
  process.exit(1);
});

