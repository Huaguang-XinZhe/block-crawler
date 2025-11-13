/**
 * 国际化工具
 * 提供轻量级的多语言支持
 */

export type Locale = 'zh' | 'en';

/**
 * 消息定义
 */
const messages = {
  zh: {
    // 通用
    'common.start': '🚀 开始爬取: {url}',
    'common.error': '❌ 处理过程中发生错误',
    'common.complete': '✅ 爬取完成！',
    
    // 爬虫任务
    'crawler.taskStart': '🚀 ===== 开始执行爬虫任务 =====',
    'crawler.targetUrl': '📍 目标URL: {url}',
    'crawler.maxConcurrency': '⚙️  最大并发数: {count}',
    'crawler.outputDir': '📂 输出目录: {dir}',
    'crawler.mode': '🎯 运行模式: {mode}',
    'crawler.modeBlock': 'Block 处理模式',
    'crawler.modePage': '页面处理模式',
    'crawler.initProgress': '📊 初始化任务进度...',
    'crawler.visiting': '📡 正在访问目标链接...',
    'crawler.pageLoaded': '✅ 页面加载完成',
    'crawler.allComplete': '🎉 ===== 所有任务已完成 =====',
    'crawler.processingCategory': '🔍 正在处理分类: {category}',
    'crawler.categoryComplete': '✅ 分类 [{category}] 处理完成',
    'crawler.startConcurrent': '🚀 开始并发处理所有链接 (最大并发: {concurrency})...',
    'crawler.startProcessing': '📦 开始处理 {total} 个集合链接...',
    'crawler.skipCompleted': '⏭️  跳过已完成的页面: {name}',
    'crawler.linkComplete': '✅ [{progress}] 完成: {name}',
    'crawler.linkFailed': '❌ [{progress}] 失败: {name}',
    'crawler.statistics': '📊 处理完成统计:',
    'crawler.success': '✅ 成功: {count}/{total}',
    'crawler.failed': '❌ 失败: {count}/{total}',
    'crawler.closePage': '🔍 关闭页面: {path}',
    
    // 进度相关
    'progress.found': '📁 发现进度文件，加载中...',
    'progress.loaded': '✅ 进度已加载: Block {blocks} 个, Page {pages} 个',
    'progress.notFound': '📝 未找到进度文件，开始全新爬取',
    'progress.saved': '💾 进度已保存 (已完成 Block: {blocks}, 已完成 Page: {pages})',
    'progress.scanning': '🔍 扫描已完成的输出文件，重建进度...',
    'progress.rebuilt': '♻️  进度已重建: Block {blocks} 个, Page {pages} 个',
    'progress.loadFailed': '⚠️ 加载进度文件失败，将重建进度',
    
    // 配置相关
    'config.parseUrlFailed': '⚠️ 解析 startUrl 失败，使用默认域名',
    
    // Tab 处理
    'tab.gettingSections': '📑 正在获取所有 Tab Sections（跳过 tab 点击）...',
    'tab.foundSections': '✅ 找到 {count} 个 Tab Section',
    'tab.processingSections': '🔄 开始遍历所有 Tab Sections...',
    'tab.processingSection': '📌 [{current}/{total}] 处理 Tab Section {index}...',
    'tab.extractingText': '📝 提取 Tab Text: {text}',
    'tab.getting': '📑 正在获取所有 Tabs...',
    'tab.found': '✅ 找到 {count} 个 Tab',
    'tab.processing': '🔄 开始遍历所有 Tabs...',
    'tab.clicking': '📌 [{current}/{total}] 点击 Tab: {text}',
    
    // 链接收集
    'link.found': '🔗 找到 {count} 个集合链接',
    'link.item': '├─ [{current}/{total}] 🔗 {link}',
    'link.name': '│  ├─ Name: {name}',
    'link.count': '│  └─ Count: {count}',
    'link.complete': '✨ 收集完成！',
    'link.totalLinks': '📊 总链接数: {count}',
    'link.totalBlocks': '📦 总组件数: {count} (展示的数量)',
    'link.extractCustom': '🔧 使用自定义 extractBlockCount 函数',
    'link.extractDefault': '📝 使用默认数字匹配逻辑提取 Block 数量',
    
    // 页面处理
    'page.processing': '🔄 [{current}/{total}] 正在处理: {path}',
    'page.skip': '⏭️  跳过已完成的页面: {path}',
    'page.skipFree': '🆓 跳过 Free 页面: {path}',
    'page.freeError': '❌ Free 页面标记匹配错误：\n   期望找到 1 个匹配项，实际找到 {count} 个\n   匹配文本: "{text}"\n\n请检查：\n   1. 文本是否唯一（建议使用更精确的文本）\n   2. 或使用自定义函数配置更精确的判断逻辑',
    'page.processFailed': '❌ 处理页面失败: {path}',
    
    // Block 处理
    'block.found': '📦 找到 {count} 个 Block',
    'block.processing': '🔄 [{current}/{total}] 正在处理 Block: {name}',
    'block.skip': '⏭️  跳过已完成的 Block: {name}',
    'block.skipFree': '🆓 跳过 Free Block: {name}',
    'block.saved': '✅ Block 已保存: {path}',
    'block.freeError': '❌ Free Block 标记匹配错误：\n   期望找到 1 个匹配项，实际找到 {count} 个\n   匹配文本: "{text}"\n\n请检查：\n   1. 文本是否唯一（建议使用更精确的文本）\n   2. 或使用自定义函数配置更精确的判断逻辑',
    'block.getNameCustom': '🔧 使用自定义 getBlockName 函数',
    'block.getAllCustom': '🔧 使用自定义 getAllBlocks 函数',
    'block.pageComplete': '✅ 页面处理完成，共 {total} 个 Block',
    'block.nameEmpty': '⚠️ block 名称为空，跳过',
    'block.processFailed': '❌ 处理 block 失败: {name}',
    'block.complexHeading': '❌ 检测到 heading 内部结构复杂（子元素 > 1）但未找到 link 元素\n\n请配置以下选项之一：\n   1. getBlockName: (block) => Promise<string | null>\n   2. blockNameLocator: string',
    
    // 元信息
    'meta.saved': '✅ 元信息已保存到: {path}',
    'meta.stats': '📊 统计信息:',
    'meta.collectedLinks': '   - 收集链接数: {count}',
    'meta.displayedTotal': '   - 展示总组件数: {count}',
    'meta.actualTotal': '   - 真实总组件数: {count}',
    'meta.freePages': '   - Free 页面数: {count}',
    'meta.freeBlocks': '   - Free Block 数: {count}',
    'meta.duration': '   - 运行耗时: {duration}s',
    'meta.isComplete': '   - 是否完整运行: {status}',
    'meta.loaded': '📥 已加载已有元信息 (Free 页面: {freePages}, Free Block: {freeBlocks})',
    'meta.loadFailed': '⚠️ 加载元信息失败: {error}',
    
    // 信号处理
    'signal.received': '⚠️  收到 {signal} 信号，正在保存进度和元信息...',
    'signal.saved': '✅ 进度和元信息已保存，程序退出',
    'signal.saveFailed': '❌ 保存失败: {error}',
  },
  en: {
    // Common
    'common.start': '🚀 Starting crawl: {url}',
    'common.error': '❌ An error occurred during processing',
    'common.complete': '✅ Crawl completed!',
    
    // Crawler tasks
    'crawler.taskStart': '🚀 ===== Starting Crawler Task =====',
    'crawler.targetUrl': '📍 Target URL: {url}',
    'crawler.maxConcurrency': '⚙️  Max Concurrency: {count}',
    'crawler.outputDir': '📂 Output Directory: {dir}',
    'crawler.mode': '🎯 Running Mode: {mode}',
    'crawler.modeBlock': 'Block Processing Mode',
    'crawler.modePage': 'Page Processing Mode',
    'crawler.initProgress': '📊 Initializing task progress...',
    'crawler.visiting': '📡 Visiting target link...',
    'crawler.pageLoaded': '✅ Page loaded successfully',
    'crawler.allComplete': '🎉 ===== All Tasks Completed =====',
    'crawler.processingCategory': '🔍 Processing category: {category}',
    'crawler.categoryComplete': '✅ Category [{category}] completed',
    'crawler.startConcurrent': '🚀 Starting concurrent processing (Max concurrency: {concurrency})...',
    'crawler.startProcessing': '📦 Processing {total} collection links...',
    'crawler.skipCompleted': '⏭️  Skipping completed page: {name}',
    'crawler.linkComplete': '✅ [{progress}] Completed: {name}',
    'crawler.linkFailed': '❌ [{progress}] Failed: {name}',
    'crawler.statistics': '📊 Processing Statistics:',
    'crawler.success': '✅ Success: {count}/{total}',
    'crawler.failed': '❌ Failed: {count}/{total}',
    'crawler.closePage': '🔍 Closing page: {path}',
    
    // Progress
    'progress.found': '📁 Progress file found, loading...',
    'progress.loaded': '✅ Progress loaded: {blocks} blocks, {pages} pages',
    'progress.notFound': '📝 No progress file found, starting fresh crawl',
    'progress.saved': '💾 Progress saved (Completed blocks: {blocks}, Completed pages: {pages})',
    'progress.scanning': '🔍 Scanning completed output files, rebuilding progress...',
    'progress.rebuilt': '♻️  Progress rebuilt: {blocks} blocks, {pages} pages',
    'progress.loadFailed': '⚠️ Failed to load progress file, will rebuild progress',
    
    // Configuration
    'config.parseUrlFailed': '⚠️ Failed to parse startUrl, using default domain',
    
    // Tab processing
    'tab.gettingSections': '📑 Getting all Tab Sections (skip tab clicking)...',
    'tab.foundSections': '✅ Found {count} Tab Sections',
    'tab.processingSections': '🔄 Processing all Tab Sections...',
    'tab.processingSection': '📌 [{current}/{total}] Processing Tab Section {index}...',
    'tab.extractingText': '📝 Extracting Tab Text: {text}',
    'tab.getting': '📑 Getting all Tabs...',
    'tab.found': '✅ Found {count} Tabs',
    'tab.processing': '🔄 Processing all Tabs...',
    'tab.clicking': '📌 [{current}/{total}] Clicking Tab: {text}',
    
    // Link collection
    'link.found': '🔗 Found {count} collection links',
    'link.item': '├─ [{current}/{total}] 🔗 {link}',
    'link.name': '│  ├─ Name: {name}',
    'link.count': '│  └─ Count: {count}',
    'link.complete': '✨ Collection complete!',
    'link.totalLinks': '📊 Total links: {count}',
    'link.totalBlocks': '📦 Total blocks: {count} (displayed count)',
    'link.extractCustom': '🔧 Using custom extractBlockCount function',
    'link.extractDefault': '📝 Using default numeric matching for block count extraction',
    
    // Page processing
    'page.processing': '🔄 [{current}/{total}] Processing: {path}',
    'page.skip': '⏭️  Skipping completed page: {path}',
    'page.skipFree': '🆓 Skipping free page: {path}',
    'page.freeError': '❌ Free page marker matching error:\n   Expected 1 match, found {count}\n   Matching text: "{text}"\n\nPlease check:\n   1. Is the text unique (use more specific text)\n   2. Or use custom function for more precise logic',
    'page.processFailed': '❌ Failed to process page: {path}',
    
    // Block processing
    'block.found': '📦 Found {count} blocks',
    'block.processing': '🔄 [{current}/{total}] Processing block: {name}',
    'block.skip': '⏭️  Skipping completed block: {name}',
    'block.skipFree': '🆓 Skipping free block: {name}',
    'block.saved': '✅ Block saved: {path}',
    'block.freeError': '❌ Free block marker matching error:\n   Expected 1 match, found {count}\n   Matching text: "{text}"\n\nPlease check:\n   1. Is the text unique (use more specific text)\n   2. Or use custom function for more precise logic',
    'block.getNameCustom': '🔧 Using custom getBlockName function',
    'block.getAllCustom': '🔧 Using custom getAllBlocks function',
    'block.pageComplete': '✅ Page processing complete, {total} blocks total',
    'block.nameEmpty': '⚠️ Block name is empty, skipping',
    'block.processFailed': '❌ Failed to process block: {name}',
    'block.complexHeading': '❌ Detected complex heading structure (children > 1) but no link element found\n\nPlease configure one of the following:\n   1. getBlockName: (block) => Promise<string | null>\n   2. blockNameLocator: string',
    
    // Meta information
    'meta.saved': '✅ Meta information saved to: {path}',
    'meta.stats': '📊 Statistics:',
    'meta.collectedLinks': '   - Collected links: {count}',
    'meta.displayedTotal': '   - Displayed total blocks: {count}',
    'meta.actualTotal': '   - Actual total blocks: {count}',
    'meta.freePages': '   - Free pages: {count}',
    'meta.freeBlocks': '   - Free blocks: {count}',
    'meta.duration': '   - Duration: {duration}s',
    'meta.isComplete': '   - Complete run: {status}',
    'meta.loaded': '📥 Loaded existing meta data (Free pages: {freePages}, Free blocks: {freeBlocks})',
    'meta.loadFailed': '⚠️ Failed to load meta information: {error}',
    
    // Signal handling
    'signal.received': '⚠️  Received {signal} signal, saving progress and metadata...',
    'signal.saved': '✅ Progress and metadata saved, exiting',
    'signal.saveFailed': '❌ Save failed: {error}',
  }
};

/**
 * 国际化类
 */
export class I18n {
  private locale: Locale;
  
  constructor(locale?: Locale) {
    this.locale = locale || 'zh';
  }
  
  /**
   * 翻译文本
   * @param key 消息键
   * @param params 参数对象
   * @returns 翻译后的文本
   */
  t(key: string, params?: Record<string, any>): string {
    const localeMessages = messages[this.locale];
    let text = localeMessages[key as keyof typeof localeMessages] || key;
    
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      });
    }
    
    return text;
  }
  
  /**
   * 获取当前语言
   */
  getLocale(): Locale {
    return this.locale;
  }
  
  /**
   * 设置语言
   */
  setLocale(locale: Locale): void {
    this.locale = locale;
  }
}

/**
 * 创建 i18n 实例
 */
export function createI18n(locale?: Locale): I18n {
  return new I18n(locale);
}

