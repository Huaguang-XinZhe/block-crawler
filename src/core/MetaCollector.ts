import fse from "fs-extra";
import path from "path";
import type { CollectionLink, SiteMeta } from "../types";
import { createI18n, type I18n, type Locale } from "../utils/i18n";

/**
 * 元信息收集器 - 负责收集和保存网站爬取元信息
 */
export class MetaCollector {
  private meta: SiteMeta;
  private metaFile: string;
  private i18n: I18n;

  constructor(startUrl: string, metaFile: string, locale?: Locale) {
    this.metaFile = metaFile;
    this.i18n = createI18n(locale);
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

    // 使用 outputJson 自动确保目录存在并写入
    await fse.outputJson(this.metaFile, this.meta, { spaces: 2 });
    
    console.log(`\n${this.i18n.t('meta.saved', { path: this.metaFile })}`);
    console.log(this.i18n.t('meta.stats'));
    console.log(this.i18n.t('meta.collectedLinks', { count: this.meta.totalLinks }));
    console.log(this.i18n.t('meta.displayedTotal', { count: this.meta.displayedTotalCount }));
    console.log(this.i18n.t('meta.actualTotal', { count: this.meta.actualTotalCount }));
    console.log(this.i18n.t('meta.freePages', { count: this.meta.freePages.total }));
    console.log(this.i18n.t('meta.freeBlocks', { count: this.meta.freeBlocks.total }));
    console.log(this.i18n.t('meta.duration', { duration: this.meta.duration }));
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
      const i18n = createI18n();
      console.warn(i18n.t('meta.loadFailed', { error: String(error) }));
    }
    return null;
  }
}

