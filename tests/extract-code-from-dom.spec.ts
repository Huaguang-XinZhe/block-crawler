import { test, type Page, type Locator } from "@playwright/test";
import fse from "fs-extra";
import { extractCodeFromBlock } from "./utils/extract-code";

test("test", async ({ page }) => {
  test.setTimeout(60000);
  await page.goto("https://pro.mufengapp.cn/components/charts/KPI-stats");
  await handleSinglePage(page, "/components/application/steppers");
});

// todo 自定义操作
// 在单个 blockCollection 页面上的处理操作（网页已加载完成）
async function handleSinglePage(page: Page, currentPath: string) {
  // 拿到所有 block 节点
  const blocks = await page.locator("xpath=//main/div/div/div").all();
  // 遍历 blocks
  for (const block of blocks) {
    // 处理每一个 block
    await handleSingleBlock(page, block, currentPath);
  }
}

// todo 自定义操作
// 处理单个 block
async function handleSingleBlock(
  page: Page,
  block: Locator,
  currentPath: string
) {
  // 拿到 block 的名称
  const blockName = await block
    .getByRole("heading", { level: 1 })
    .getByRole("link")
    .textContent();
  // console.log(blockName);
  // 点击 Code
  await block.getByRole("tab", { name: "Code" }).click();

  // 提取代码并清理重复内容
  const code = await extractCodeFromBlock(block);

  // 输出到文件
  await fse.outputFile(`output/${currentPath}/${blockName}/App.tsx`, code);
}
