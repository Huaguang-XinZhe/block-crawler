import { test, type Page, type Locator } from "@playwright/test";
import fse from "fs-extra";
import pLimit from "p-limit";
import { extractCodeFromBlock } from "../utils/extract-code";
import { TaskProgress } from "../utils/task-progress";

const START_URL = "https://pro.mufengapp.cn/components";
// const START_URL = "https://www.shadcndesign.com/pro-blocks";
// 如果不穿这个，就默认不配 name，然后取第一个 tablist
const TABLIST_ARIA_LABEL = "Categories";
// 并发网页 Tab 的最大数量
const MAX_PAGE_COUNT = 5;
const OUTPUT_DIR = "output";
const PROGRESS_FILE = "progress.json";
const TIMEOUT_MS = 2 * 60 * 1000; // 2 分钟

// 所有的集合链接，用于并发处理
const allCollectionLinks: string[] = [];
// 总共的 block个数
let totalBlockCount = 0;

// 并发处理限制（最多同时开 MAX_PAGE_COUNT 个网页 Tab）
const limit = pLimit(MAX_PAGE_COUNT);

// 任务进度管理器
const taskProgress = new TaskProgress(PROGRESS_FILE, OUTPUT_DIR);

test("test", async ({ page }) => {
  console.log("\n🚀 ===== 开始执行测试 =====");
  console.log(`📍 目标URL: ${START_URL}`);
  console.log(`⚙️  最大并发数: ${MAX_PAGE_COUNT}`);

  // 设置超时
  test.setTimeout(TIMEOUT_MS);

  // 初始化任务进度
  console.log("\n📊 初始化任务进度...");
  await taskProgress.initialize();

  // 访问目标链接
  console.log("\n📡 正在访问目标链接...");
  await page.goto(START_URL);
  console.log("✅ 页面加载完成");

  // // 等待网络请求完成
  // await page.waitForLoadState('networkidle');
  // 等待文档加载完成
  // await page.waitForLoadState("domcontentloaded");

  console.log("\n📑 正在获取所有分类标签...");
  const tabs = await getAllTabs(page);
  console.log(`✅ 找到 ${tabs.length} 个分类标签`);

  // 循环 tab
  console.log("\n🔄 开始遍历所有分类标签...");
  for (let i = 0; i < tabs.length; i++) {
    const tab = tabs[i];
    console.log(`\n📌 [${i + 1}/${tabs.length}] 处理分类标签...`);
    // 点击切换 tab
    await clickTab(tab, i);
    // 处理单个 tab
    await handleSingleTab(page, tab);
  }

  console.log(`\n✨ 收集完成！总共 ${totalBlockCount} 个 blocks`);
  console.log(`📊 总共 ${allCollectionLinks.length} 个集合链接待处理\n`);

  // 按 limit 并发处理所有链接
  console.log(`\n🚀 开始并发处理所有链接 (最大并发: ${MAX_PAGE_COUNT})...`);
  try {
    await concurrentHandleLinksByLimit(page);
    console.log("\n🎉 ===== 所有任务已完成 ===== \n");
  } catch (error) {
    console.error("\n❌ 处理过程中发生错误，正在保存进度...");
    throw error;
  } finally {
    // 保存最终进度
    await taskProgress.saveProgress();
    console.log(
      `\n💾 进度已保存 (已完成: ${taskProgress.getCompletedCount()} 个 blocks)`
    );
  }
});

// 按 limit 并发处理所有链接
async function concurrentHandleLinksByLimit(page: Page) {
  const total = allCollectionLinks.length;
  let completed = 0;
  let failed = 0;

  console.log(`\n📦 开始处理 ${total} 个集合链接...`);

  await Promise.allSettled(
    allCollectionLinks.map((relativeLink, index) =>
      limit(async () => {
        try {
          await handleSingleLink(page, relativeLink, index === 0);
          completed++;
          const linkName = relativeLink.split("/").pop() || relativeLink;
          console.log(
            `✅ [${completed + failed}/${total}] 完成: ${linkName}\n`
          );
        } catch (error) {
          failed++;
          const linkName = relativeLink.split("/").pop() || relativeLink;
          console.error(
            `❌ [${completed + failed}/${total}] 失败: ${linkName}\n`,
            error
          );
          // 不重新抛出，继续处理其他任务
        }
      })
    )
  );

  console.log(`\n📊 处理完成统计:`);
  console.log(`   ✅ 成功: ${completed}/${total}`);
  console.log(`   ❌ 失败: ${failed}/${total}`);
}

// 处理单个链接
async function handleSingleLink(
  page: Page,
  relativeLink: string,
  isFirst: boolean
) {
  // 从 START_URL 中获取域名，然后再拼接
  const domain = new URL(START_URL).hostname;
  const url = `https://${domain}${relativeLink}`;

  // 如果是第一个链接，则使用原来的 page，否则新建一个 page
  const newPage = isFirst ? page : await page.context().newPage(); // 通过 context 新建网页 Tab

  try {
    await newPage.goto(url);
    // await newPage.waitForLoadState("networkidle");
    // await newPage.waitForLoadState("domcontentloaded");
    // 在单个 blockCollection 页面上的处理操作
    await handleSinglePage(newPage, relativeLink);
  } finally {
    console.log(`\n🔍 关闭页面: ${relativeLink}`);
    await newPage.close();
  }
}

// 在单个 blockCollection 页面上的处理操作（网页已加载完成）
async function handleSinglePage(page: Page, currentPath: string) {
  // 拿到所有 block 节点
  const blocks = await page.locator("xpath=//main/div/div/div").all();

  // 遍历 blocks
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    // 处理每一个 block
    await handleSingleBlock(page, block, currentPath);
  }
}

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

  if (!blockName) {
    console.warn("⚠️ block 名称为空，跳过");
    return;
  }

  console.log(`\n🔍 正在处理 block: ${blockName}`);

  // 构建 block 完整路径（移除前导斜杠，确保格式一致）
  const normalizedPath = currentPath.startsWith("/")
    ? currentPath.slice(1)
    : currentPath;
  const blockPath = `${normalizedPath}/${blockName}`;

  // 检查是否已完成
  if (taskProgress.isComplete(blockPath)) {
    console.log(`⏭️  跳过已完成的 block: ${blockName}`);
    return;
  }

  // 点击切换到 Code
  await clickCodeTab(block);

  // 获取 ts 部分代码
  await saveAllLanguageFiles(block, currentPath, blockName, "ts");

  // 切换 js
  await block.getByRole("button", { name: "TypeScript Change theme" }).click();
  // 这里不能用 block 去找，必须用 page，因为它被传送到了 body 下❗
  await page.getByRole("option", { name: "JavaScript" }).click();

  // 切换后，得延迟一会儿，不然 fileTabs 还是之前的（这样的话，获取的第一个 fileTab 就是 App.tsx）
  await page.waitForTimeout(500);

  // 获取 js 部分代码
  await saveAllLanguageFiles(block, currentPath, blockName, "js");

  // 标记为已完成
  taskProgress.markComplete(blockPath);
}

// 点击 Code（至关重要，有时候没反应❗），如果超时再点击一次
async function clickCodeTab(block: Locator) {
  const codeTab = block.getByRole("tab", { name: "Code" });
  await codeTab.click();
  try {
    // 等待 App.tsx 出现（成功即继续）
    await block
      .getByText("App.tsx")
      .waitFor({ state: "visible", timeout: 1500 });
  } catch (e) {
    // 超时未出现，继续再点击一次
    console.warn("⚠️ Code tab first click timeout, retrying...");
    await codeTab.click();
    // 再等一次，如果这次还没出来就抛错
    await block
      .getByText("App.tsx")
      .waitFor({ state: "visible", timeout: 3000 });
  }
}

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
  for (let i = 0; i < fileTabs.length; i++) {
    const fileTab = fileTabs[i];

    if (i != 0) {
      // 点击切换到文件 Tab
      await fileTab.click();
    }

    const fileName = await fileTab.textContent();
    // 使用封装的代码提取函数，避免重复内容和格式问题
    const code = await extractCodeFromBlock(block);
    // console.log(code);
    // 输出到文件
    if (blockName && fileName) {
      await fse.outputFile(
        `${OUTPUT_DIR}/${currentPath}/${blockName}/${language}/${fileName}`,
        code
      );
    } else {
      console.warn("blockName or fileName is null");
      console.log(`blockName: ${blockName}, fileName: ${fileName}`);
    }
  }
}

/**
 * ⚠️ 并发安全问题修复：
 *
 * 之前的实现使用了系统剪贴板来复制代码，存在严重的竞态条件问题：
 * 1. 页面A点击复制按钮 → 内容写入剪贴板
 * 2. 页面B点击复制按钮 → 覆盖剪贴板内容
 * 3. 页面A读取剪贴板 → 读到的是页面B的内容 ❌
 * 4. 结果：两个不同的组件保存了相同的代码片段
 *
 * 解决方案：
 * 直接从DOM中提取代码内容，完全避免使用共享的剪贴板资源。
 * 这样每个页面都独立获取自己的代码内容，不会相互干扰。
 */
//
// // 复制当前文件的代码到指定文件中
// async function copyCodeToFile(
//   block: Locator,
//   currentPath: string,
//   blockName: string | null,
//   fileName: string | null,
//   language: 'ts' | 'js'
// ) {
//   // 点击复制按钮
//   await block.getByRole("button", { name: "Copy Code" }).nth(1).click();

//   // 把复制内容写入文件
//   // 读取剪贴板
//   const clipboardContent = await block.evaluate(() => {
//     return navigator.clipboard.readText();
//   });

//   if (blockName && fileName) {
//     // 这里不要用 writeFile（需要文件目录存在❗）
//     const outputPath = `output/${currentPath}/${blockName}/${language}/${fileName}`;
//     await fse.outputFile(outputPath, clipboardContent);
//   }
// }

// 获取所有的 tab
async function getAllTabs(page: Page) {
  const tabList = await page.getByRole("tablist", { name: TABLIST_ARIA_LABEL });
  return await tabList.getByRole("tab").all();
}

// 点击 tab
async function clickTab(tab: Locator, index: number) {
  const text = await tab.textContent();

  // 第一个跳过点击
  if (index === 0) {
    console.log(`   ⏭️  跳过第一个标签 (默认选中): ${text}`);
    return;
  }

  console.log(`   🖱️  点击标签: ${text}`);
  await tab.click();
}

// 处理单个 tab
async function handleSingleTab(page: Page, tab: Locator) {
  const text = (await tab.textContent()) ?? "";
  console.log(`   🔍 正在处理分类: ${text}`);
  const section = await page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: text }) });
  // 收集所有的链接
  await collectAllLinks(section);
  console.log(`   ✅ 分类 [${text}] 处理完成`);
}

// 收集所有的链接
async function collectAllLinks(section: Locator) {
  // 获取子 section 中的所有 a 标签
  const aTags = await section.locator("section > a").all();
  console.log(`      🔗 找到 ${aTags.length} 个集合链接`);

  // 遍历，获取 a 标签内部的 block 集合名称、内部 block 个数、集合链接
  for (let i = 0; i < aTags.length; i++) {
    const aTag = aTags[i];
    // 通过 XPath 定位
    const blockCollectionName = await aTag
      .locator("xpath=/div[2]/div[1]/div[1]")
      .textContent();
    const blockCountText = await aTag
      .locator("xpath=/div[2]/div[1]/div[2]")
      .textContent();
    const collectionLink = await aTag.getAttribute("href");

    const blockCount = extractBlockCount(blockCountText);

    // 树状结构打印
    console.log(
      `      ├─ [${i + 1}/${aTags.length}] 📦 ${blockCollectionName}`
    );
    console.log(`      │  ├─ Path: ${collectionLink}`);
    console.log(`      │  └─ Count: ${blockCountText}`);

    totalBlockCount += blockCount;

    if (collectionLink) {
      allCollectionLinks.push(collectionLink);
    }
  }
}

// 工具函数，从 block 个数文本中提取 block 个数
function extractBlockCount(blockCountText: string | null) {
  // 文本可能像这样：7 blocks、10 components
  // 匹配获取其中的数字
  const match = blockCountText?.match(/\d+/);
  return match ? parseInt(match[0] ?? "0") : 0;
}
