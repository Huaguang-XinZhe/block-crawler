import * as fse from "fs-extra";
import type { CollectionLink, SiteMeta } from "../types";

/**
 * 元信息收集器 - 负责收集和保存网站爬取元信息
 */
export class MetaCollector {
  private meta: SiteMeta;
  private metaFile: string;

  constructor(startUrl: string, metaFile: string) {
    this.metaFile = metaFile;
    this.meta = {
      startUrl,
      collectionLinks: [],
      totalLinks: 0,
      displayedTotalCount: 0,
      actualTotalCount: 0,
      freePages: {
        total: 0,
        links: [],
      },
      freeBlocks: {
        total: 0,
        blockNames: [],
      },
      startTime: new Date().toISOString(),
    };
  }

  /**
   * 添加收集到的链接
   */
  addCollectionLinks(links: CollectionLink[]): void {
    this.meta.collectionLinks.push(...links);
    // 累加展示的总数
    this.meta.displayedTotalCount += links.reduce((sum, link) => sum + (link.count || 0), 0);
  }

  /**
   * 增加实际组件数
   */
  incrementActualCount(count: number = 1): void {
    this.meta.actualTotalCount += count;
  }

  /**
   * 记录 Free 页面
   */
  addFreePage(link: string): void {
    this.meta.freePages.links.push(link);
    this.meta.freePages.total++;
  }

  /**
   * 记录 Free Block
   */
  addFreeBlock(blockName: string): void {
    this.meta.freeBlocks.blockNames.push(blockName);
    this.meta.freeBlocks.total++;
  }

  /**
   * 获取当前元信息
   */
  getMeta(): SiteMeta {
    return { ...this.meta };
  }

  /**
   * 保存元信息到文件
   */
  async save(): Promise<void> {
    // 记录结束时间和总耗时
    const endTime = new Date();
    this.meta.endTime = endTime.toISOString();
    this.meta.duration = Math.floor((endTime.getTime() - new Date(this.meta.startTime).getTime()) / 1000);
    
    // 更新链接总数
    this.meta.totalLinks = this.meta.collectionLinks.length;

    await fse.ensureDir(this.metaFile.substring(0, this.metaFile.lastIndexOf("/")));
    await fse.writeJson(this.metaFile, this.meta, { spaces: 2 });
    
    console.log(`\n✅ 元信息已保存到: ${this.metaFile}`);
    console.log(`📊 统计信息:`);
    console.log(`   - 收集链接数: ${this.meta.totalLinks}`);
    console.log(`   - 展示总组件数: ${this.meta.displayedTotalCount}`);
    console.log(`   - 真实总组件数: ${this.meta.actualTotalCount}`);
    console.log(`   - Free 页面数: ${this.meta.freePages.total}`);
    console.log(`   - Free Block 数: ${this.meta.freeBlocks.total}`);
    console.log(`   - 总耗时: ${this.meta.duration}s`);
  }

  /**
   * 加载已有的元信息（用于进度恢复）
   */
  static async load(metaFile: string): Promise<SiteMeta | null> {
    try {
      if (await fse.pathExists(metaFile)) {
        return await fse.readJson(metaFile);
      }
    } catch (error) {
      console.warn(`⚠️ 加载元信息失败: ${error}`);
    }
    return null;
  }
}

