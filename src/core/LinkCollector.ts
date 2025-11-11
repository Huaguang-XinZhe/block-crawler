import type { Locator } from "@playwright/test";
import type { CollectionLink } from "../types";
import type { InternalConfig } from "./ConfigManager";

/**
 * 链接收集器
 * 职责：收集页面中的所有集合链接
 */
export class LinkCollector {
  private allCollectionLinks: CollectionLink[] = [];
  private totalBlockCount = 0;

  constructor(private config: InternalConfig) {}

  /**
   * 收集所有的链接
   */
  async collectLinks(section: Locator): Promise<void> {
    // 验证必需的定位符配置
    if (
      !this.config.collectionLinkLocator ||
      !this.config.collectionNameLocator ||
      !this.config.collectionCountLocator
    ) {
      throw new Error(
        "链接收集定位符未配置！请设置 collectionLinkLocator、collectionNameLocator 和 collectionCountLocator"
      );
    }

    // 获取所有链接元素
    const aTags = await section.locator(this.config.collectionLinkLocator).all();
    console.log(`      🔗 找到 ${aTags.length} 个集合链接`);

    // 遍历每个链接
    for (let i = 0; i < aTags.length; i++) {
      const aTag = aTags[i];

      // 提取链接信息
      const blockCollectionName = await aTag
        .locator(this.config.collectionNameLocator)
        .textContent();
      const blockCountText = await aTag
        .locator(this.config.collectionCountLocator)
        .textContent();
      const collectionLink = await aTag.getAttribute("href");

      const blockCount = this.extractBlockCount(blockCountText);

      // 日志输出
      console.log(`      ├─ [${i + 1}/${aTags.length}] 📦 ${blockCollectionName}`);
      console.log(`      │  ├─ Path: ${collectionLink}`);
      console.log(`      │  └─ Count: ${blockCountText}`);

      this.totalBlockCount += blockCount;

      if (collectionLink) {
        this.allCollectionLinks.push({
          link: collectionLink,
          name: blockCollectionName || undefined,
          count: blockCount,
        });
      }
    }
  }

  /**
   * 从文本中提取 Block 数量
   */
  private extractBlockCount(blockCountText: string | null): number {
    // 文本可能像这样：7 blocks、10 components
    // 匹配获取其中的数字
    const match = blockCountText?.match(/\d+/);
    return match ? parseInt(match[0] ?? "0") : 0;
  }

  /**
   * 获取所有收集的链接
   */
  getAllLinks(): CollectionLink[] {
    return this.allCollectionLinks;
  }

  /**
   * 获取总 Block 数量
   */
  getTotalBlockCount(): number {
    return this.totalBlockCount;
  }

  /**
   * 重置收集的数据
   */
  reset(): void {
    this.allCollectionLinks = [];
    this.totalBlockCount = 0;
  }
}

