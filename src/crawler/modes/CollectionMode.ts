import type { Page } from "@playwright/test";
import type { CollectResult } from "../../collectors/types";
import type { InternalConfig } from "../../config/ConfigManager";
import { createI18n, type I18n } from "../../utils/i18n";
import type { CollectionConfig } from "../utils/ConfigHelper";
import { ConfigHelper } from "../utils/ConfigHelper";

/**
 * 收集模式
 *
 * 职责：
 * - 执行链接收集
 * - 从 collect.json 加载
 */
export class CollectionMode {
  private i18n: I18n;

  constructor(
    private config: InternalConfig,
    private page: Page
  ) {
    this.i18n = createI18n(config.locale);
  }

  /**
   * 执行收集（智能跳过逻辑）
   * 1. 如果已有 collect.json，直接加载返回
   * 2. 如果配置了 section 且没有 collect.json，执行收集
   * 3. 其他情况返回空结果
   */
  async execute(collectionConfig: CollectionConfig): Promise<CollectResult> {
    if (!collectionConfig.startUrl) {
      throw new Error("未配置 startUrl。请在构造函数中配置 startUrl 参数。");
    }

    // 优先尝试从 collect.json 加载
    const existingResult = await this.tryLoadFromFile(
      collectionConfig.startUrl
    );
    if (existingResult) {
      // 已有 collect.json → 直接使用
      console.log(this.i18n.t("collection.skipExisting"));
      return existingResult;
    }

    const hasSection = ConfigHelper.hasSection(collectionConfig);

    // 未配置 section 且没有 collect.json → 跳过收集
    if (!hasSection) {
      console.log(this.i18n.t("collection.skipped"));
      return this.emptyResult();
    }

    // 配置了 section + 没有 collect.json → 执行收集
    return await this.performCollection(collectionConfig);
  }

  /**
   * 执行新的收集
   */
  private async performCollection(
    collectionConfig: CollectionConfig
  ): Promise<CollectResult> {
    const { LinkCollector } = await import("../../collectors/LinkCollector");

    const config = ConfigHelper.buildCollectorConfig(
      collectionConfig,
      this.page,
      this.config.locale,
      this.config.stateBaseDir
    );

    const collector = new LinkCollector(config);
    return await collector.run();
  }

  /**
   * 尝试从 collect.json 加载（不抛出错误）
   */
  private async tryLoadFromFile(
    startUrl: string
  ): Promise<CollectResult | null> {
    const { CollectResultStore } =
      await import("../../collectors/store/CollectResultStore");
    const store = new CollectResultStore(
      startUrl,
      this.config.stateBaseDir,
      this.config.locale
    );

    return await store.load();
  }

  /**
   * 返回空的收集结果
   */
  private emptyResult(): CollectResult {
    return {
      lastUpdate: new Date().toISOString(),
      totalLinks: 0,
      totalBlocks: 0,
      collections: [],
    };
  }
}
