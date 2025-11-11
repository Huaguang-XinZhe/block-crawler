import { test } from "@playwright/test";
import { BlockCrawler } from "ui-blocks-crawler";

test("untitledui", async ({ page }) => {
  const crawler = new BlockCrawler({
    startUrl: "https://www.untitledui.com/react/components",
    collectionLinkLocator: "a",
    collectionNameLocator: "h3",
    collectionCountLocator: "p",
    
    // 使用新的 getAllTabSections 模式（跳过 tab 点击）
    getAllTabSections: async (page) => {
      // 返回所有包含内容的 sections
      return page.locator("xpath=//section[3]/div/div").all();
    },
    extractTabTextFromSection: async (section) => {
      // 从 section 中提取 tab 文本（使用 h2 标题）
      return section.getByRole("heading", { level: 2 }).textContent();
    },
    
    // 处理 "1 component + 6 variants" 格式
    extractBlockCount: (text) => {
      const match = text?.match(/(\d+)\s*component.*?(\d+)\s*variant/);
      if (match) {
        return parseInt(match[1] ?? "0") + parseInt(match[2] ?? "0");
      }
      const simpleMatch = text?.match(/\d+/);
      return simpleMatch ? parseInt(simpleMatch[0] ?? "0") : 0;
    },
  });
});
