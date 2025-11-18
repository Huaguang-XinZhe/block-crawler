import fse from "fs-extra";
import type { CollectionLink, SiteMeta } from "../types";
import { createI18n, type I18n, type Locale } from "../utils/i18n";
import { atomicWriteJson } from "../utils/atomic-write";

/**
 * 元信息收集器 - 负责收集和保存网站爬取元信息
 */
export class MetaCollector {
  private meta: SiteMeta;
  private metaFile: string;
  private i18n: I18n;
  private startTime: Date;
  private progressEnabled: boolean;

  constructor(startUrl: string, metaFile: string, locale?: Locale, progressEnabled: boolean = true) {
    this.metaFile = metaFile;
    this.i18n = createI18n(locale);
    this.startTime = new Date();
    this.progressEnabled = progressEnabled;
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
   * 
   * 如果开启了进度恢复，则覆盖（避免重复累加）；否则累加
   */
  incrementActualCount(count: number = 1): void {
    if (this.progressEnabled) {
      // 进度恢复开启时覆盖（不累加），因为恢复的页面不会被重新处理
      this.meta.actualTotalCount = count;
    } else {
      // 进度恢复关闭时累加
      this.meta.actualTotalCount += count;
    }
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
   * 检查是否有实际内容
   */
  private hasContent(): boolean {
    return (
      this.meta.collectionLinks.length > 0 ||
      this.meta.freePages.links.length > 0 ||
      this.meta.freeBlocks.blockNames.length > 0 ||
      this.meta.displayedTotalCount > 0 ||
      this.meta.actualTotalCount > 0
    );
  }

  /**
   * 判断是否应该跳过保存（无内容且已有文件存在）
   */
  private async shouldSkipSave(): Promise<boolean> {
    if (this.hasContent()) {
      return false;
    }
    const existingMeta = await MetaCollector.load(this.metaFile);
    return existingMeta !== null;
  }

  /**
   * 合并已有数据（保留已有的 collectionLinks、freePages、freeBlocks）
   */
  private mergeWithExisting(existingMeta: SiteMeta): SiteMeta {
    // 合并 collectionLinks（去重）
    const existingLinks = new Map<string, CollectionLink>();
    (existingMeta.collectionLinks || []).forEach(link => {
      existingLinks.set(link.link, link);
    });
    this.meta.collectionLinks.forEach(link => {
      existingLinks.set(link.link, link);
    });

    // 合并 freePages（去重）
    const existingFreePages = new Set(existingMeta.freePages?.links || []);
    this.meta.freePages.links.forEach(link => existingFreePages.add(link));

    // 合并 freeBlocks（去重）
    const existingFreeBlocks = new Set(existingMeta.freeBlocks?.blockNames || []);
    this.meta.freeBlocks.blockNames.forEach(name => existingFreeBlocks.add(name));

    return {
      ...this.meta,
      collectionLinks: Array.from(existingLinks.values()),
      totalLinks: existingLinks.size,
      displayedTotalCount: Math.max(
        existingMeta.displayedTotalCount || 0,
        this.meta.displayedTotalCount
      ),
      actualTotalCount: Math.max(
        existingMeta.actualTotalCount || 0,
        this.meta.actualTotalCount
      ),
      freePages: {
        total: existingFreePages.size,
        links: Array.from(existingFreePages),
      },
      freeBlocks: {
        total: existingFreeBlocks.size,
        blockNames: Array.from(existingFreeBlocks),
      },
    };
  }

  /**
   * 准备要保存的元数据（更新时间和状态，合并已有数据）
   */
  private async prepareMetaForSave(isComplete: boolean): Promise<SiteMeta> {
    const endTime = new Date();
    this.meta.isComplete = isComplete;
    this.meta.startTime = this.startTime.toLocaleString();
    this.meta.duration = Math.floor((endTime.getTime() - this.startTime.getTime()) / 1000);
    this.meta.totalLinks = this.meta.collectionLinks.length;

    const existingMeta = await MetaCollector.load(this.metaFile);
    if (existingMeta) {
      return this.mergeWithExisting(existingMeta);
    }
    return { ...this.meta };
  }

  /**
   * 输出保存统计信息
   */
  private logSaveStats(finalMeta: SiteMeta, isComplete: boolean): void {
    console.log(`\n${this.i18n.t('meta.saved', { path: this.metaFile })}`);
    console.log(this.i18n.t('meta.stats'));
    console.log(this.i18n.t('meta.collectedLinks', { count: finalMeta.totalLinks }));
    console.log(this.i18n.t('meta.displayedTotal', { count: finalMeta.displayedTotalCount }));
    console.log(this.i18n.t('meta.actualTotal', { count: finalMeta.actualTotalCount }));
    console.log(this.i18n.t('meta.freePages', { count: finalMeta.freePages.total }));
    console.log(this.i18n.t('meta.freeBlocks', { count: finalMeta.freeBlocks.total }));
    console.log(this.i18n.t('meta.duration', { duration: finalMeta.duration }));
    const statusText = this.i18n.getLocale() === 'zh' 
      ? (isComplete ? '是' : '否')
      : (isComplete ? 'Yes' : 'No');
    console.log(this.i18n.t('meta.isComplete', { status: statusText }));
  }

  /**
   * 保存元信息到文件
   */
  async save(isComplete: boolean = false): Promise<void> {
    // 检查是否应该跳过保存
    if (await this.shouldSkipSave()) {
      console.log(this.i18n.t('meta.skipEmpty', { path: this.metaFile }));
      return;
    }

    // 准备要保存的数据
    const finalMeta = await this.prepareMetaForSave(isComplete);

    // 使用原子写入工具保存
    try {
      await atomicWriteJson(this.metaFile, finalMeta);
    } catch (error) {
      console.error(this.i18n.t('meta.saveFailed', { 
        path: this.metaFile, 
        error: String(error) 
      }));
      throw error;
    }

    // 输出统计信息
    this.logSaveStats(finalMeta, isComplete);
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

  /**
   * 从已有的 meta.json 中加载 Free 页面列表
   * 用于在不恢复进度的情况下，跳过已知的 Free 页面
   */
  static async loadFreePages(metaFile: string): Promise<string[]> {
    const meta = await this.load(metaFile);
    return meta?.freePages?.links || [];
  }
}

