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
  private startTime: Date;

  constructor(startUrl: string, metaFile: string, locale?: Locale) {
    this.metaFile = metaFile;
    this.i18n = createI18n(locale);
    this.startTime = new Date();
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
      isComplete: false,
    };
  }

  /**
   * 初始化：加载已有的元信息（如果存在）
   */
  async initialize(): Promise<void> {
    const existingMeta = await MetaCollector.load(this.metaFile);
    if (existingMeta) {
      // 合并已有的 freePages 和 freeBlocks（去重）
      const existingFreePages = new Set(existingMeta.freePages?.links || []);
      const existingFreeBlocks = new Set(existingMeta.freeBlocks?.blockNames || []);
      
      this.meta.freePages.links = Array.from(existingFreePages);
      this.meta.freePages.total = this.meta.freePages.links.length;
      this.meta.freeBlocks.blockNames = Array.from(existingFreeBlocks);
      this.meta.freeBlocks.total = this.meta.freeBlocks.blockNames.length;
      
      console.log(this.i18n.t('meta.loaded', { 
        freePages: this.meta.freePages.total, 
        freeBlocks: this.meta.freeBlocks.total 
      }));
    }
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
   * 记录 Free 页面（去重追加）
   */
  addFreePage(link: string): void {
    if (!this.meta.freePages.links.includes(link)) {
      this.meta.freePages.links.push(link);
      this.meta.freePages.total = this.meta.freePages.links.length;
    }
  }

  /**
   * 记录 Free Block（去重追加）
   */
  addFreeBlock(blockName: string): void {
    if (!this.meta.freeBlocks.blockNames.includes(blockName)) {
      this.meta.freeBlocks.blockNames.push(blockName);
      this.meta.freeBlocks.total = this.meta.freeBlocks.blockNames.length;
    }
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
  async save(isComplete: boolean = false): Promise<void> {
    // 更新时间和完成状态
    const endTime = new Date();
    this.meta.isComplete = isComplete;
    this.meta.startTime = this.startTime.toLocaleString();
    this.meta.duration = Math.floor((endTime.getTime() - this.startTime.getTime()) / 1000);
    
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
    const statusText = this.i18n.getLocale() === 'zh' 
      ? (isComplete ? '是' : '否')
      : (isComplete ? 'Yes' : 'No');
    console.log(this.i18n.t('meta.isComplete', { status: statusText }));
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

