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
    if (!this.config.collectionLinkLocator) {
      throw new Error(
        "链接收集定位符未配置！请设置 collectionLinkLocator"
      );
    }

    // 获取所有链接元素
    const aTags = await section.locator(this.config.collectionLinkLocator).all();
    console.log(`      🔗 找到 ${aTags.length} 个集合链接`);

    // 遍历每个链接
    for (let i = 0; i < aTags.length; i++) {
      const aTag = aTags[i];

      // 提取链接
      const collectionLink = await aTag.getAttribute("href");
      
      // 提取名称（可选）
      let blockCollectionName: string | null = null;
      if (this.config.collectionNameLocator) {
        blockCollectionName = await aTag
          .locator(this.config.collectionNameLocator)
          .textContent();
      }
      
      // 提取数量（可选）
      let blockCountText: string | null = null;
      let blockCount = 0;
      if (this.config.collectionCountLocator) {
        blockCountText = await aTag
          .locator(this.config.collectionCountLocator)
          .textContent();
        blockCount = this.extractBlockCount(blockCountText);
        this.totalBlockCount += blockCount;
      }

      // 日志输出
      console.log(`      ├─ [${i + 1}/${aTags.length}] 🔗 ${collectionLink}`);
      if (blockCollectionName) {
        console.log(`      │  ├─ Name: ${blockCollectionName}`);
      }
      if (blockCountText) {
        console.log(`      │  └─ Count: ${blockCountText}`);
      }

      if (collectionLink) {
        this.allCollectionLinks.push({
          link: collectionLink,
          name: blockCollectionName || undefined,
          count: blockCount > 0 ? blockCount : undefined,
        });
      }
    }
  }

  /**
   * 从文本中提取 Block 数量
   */
  private extractBlockCount(blockCountText: string | null): number {
    // 如果配置了自定义提取函数，优先使用
    if (this.config.extractBlockCount) {
      console.log(`      🔧 使用自定义 extractBlockCount 函数`);
      return this.config.extractBlockCount(blockCountText);
    }
    
    // 默认实现：匹配文本中的第一个数字
    // 文本可能像这样：7 blocks、10 components
    console.log(`      📝 使用默认数字匹配逻辑提取 Block 数量`);
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

