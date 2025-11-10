import type { Locator } from "@playwright/test";

/**
 * 从 block 元素中提取代码内容
 * @param block - Playwright Locator 元素
 * @returns 提取的代码字符串
 */
export async function extractCodeFromBlock(block: Locator): Promise<string> {
  return await block.evaluate((element) => {
    const pre = element.querySelector("pre");
    if (!pre) return "";

    // 克隆元素以避免影响页面
    const clone = pre.cloneNode(true) as HTMLElement;

    // 移除所有导致重复的元素
    clone.querySelectorAll(".copy-token").forEach((el) => el.remove());

    // 每个 summary 内的 ellipsis-token 其后所有兄弟元素都移除（它们都是 span）
    clone.querySelectorAll("summary").forEach((summary) => {
      const ellipsis = summary.querySelector(".ellipsis-token");
      if (ellipsis) {
        let sibling = ellipsis.nextSibling;
        while (sibling) {
          const next = sibling.nextSibling;
          sibling.remove();
          sibling = next;
        }
        ellipsis.remove();
      }
    });

    // 获取所有 token-line 的文本内容并用换行符连接
    const lines = Array.from(clone.querySelectorAll(".token-line"));
    return lines
      .map((line) => (line as HTMLElement).textContent || "")
      .join("\n");
  });
}

