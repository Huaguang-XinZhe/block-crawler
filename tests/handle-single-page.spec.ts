import { test, type Page, type Locator } from "@playwright/test";
import fse from "fs-extra";

test("test", async ({ page }) => {
  test.setTimeout(60000)
  await page.goto("https://pro.mufengapp.cn/components/application/steppers");
  await handleSinglePage(page, '/components/application/steppers');
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
  // 点击 Code
  await block.getByRole("tab", { name: "Code" }).click();
  // 获取 ts 部分代码
  await saveAllLanguageFiles(block, currentPath, blockName, "ts");

  // 切换 js
  await block.getByRole("button", { name: "TypeScript Change theme" }).click();
  //   await block.getByRole("option", { name: "JavaScript" }).click();
  // 这里不能用 block 去找，必须用 page，因为它被传送到了 body 下❗
  await page.getByRole("option", { name: "JavaScript" }).click();
  // 获取 js 部分代码
  await saveAllLanguageFiles(block, currentPath, blockName, "js");
}

// todo 自定义操作
// 保存当前语言版本的所有文件代码到指定目录
async function saveAllLanguageFiles(
  block: Locator,
  currentPath: string,
  blockName: string | null,
  language: "ts" | "js"
) {
  // 复制当前文件的内容
  // - tablist "Select active file":
  // - tab "App.tsx" [selected]
  // - tab "acme.tsx"
  // - tab "types.ts"
  const fileTabs = await block
    .getByRole("tablist", {
      name: "Select active file",
    })
    .getByRole("tab")
    .all();

  // 不能在 forEach 里边用 async，不会等待其完成❗
  // fileTabs.forEach(async (fileTab, index) => {

  // });

  for (let i = 0; i < fileTabs.length; i++) {
    const fileTab = fileTabs[i];

    if (i != 0) {
      // 点击切换到文件 Tab
      await fileTab.click();
    }

    const fileName = await fileTab.textContent();
    await copyCodeToFile(block, currentPath, blockName, fileName, language);
  }
}

// todo 自定义操作
// 复制当前文件的代码到指定文件中
async function copyCodeToFile(
  block: Locator,
  currentPath: string,
  blockName: string | null,
  fileName: string | null,
  language: "ts" | "js"
) {
  // 点击复制按钮
  await block.getByRole("button", { name: "Copy Code" }).nth(1).click();
  // 把复制内容写入 App.tsx 文件
  // 读取剪贴板
  const clipboardContent = await block.evaluate(() => {
    return navigator.clipboard.readText();
  });

  if (blockName && fileName) {
    // 这里不要用 writeFile（需要文件目录存在❗）
    await fse.outputFile(
      `output/${currentPath}/${blockName}/${language}/${fileName}`,
      clipboardContent
    );
  } else {
    console.warn("blockName or fileName is null");
    console.log(`blockName: ${blockName}, fileName: ${fileName}`);
  }
}