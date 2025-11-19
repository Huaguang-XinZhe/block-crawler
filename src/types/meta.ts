/**
 * 链接收集结果
 */
export interface CollectionLink {
	/** 链接地址 */
	link: string;
	/** 链接名称 */
	name?: string;
	/** Block 数量 */
	count?: number;
}

/**
 * Free 页面/Block 信息
 */
export interface FreeItem {
	/** 链接或 Block 名称 */
	name: string;
	/** 是否为 free */
	isFree: boolean;
}

/**
 * 网站元信息
 */
export interface SiteMeta {
	/** 起始 URL */
	startUrl: string;
	/** 所有收集到的链接 */
	collectionLinks: CollectionLink[];
	/** 收集到的链接总数 */
	totalLinks: number;
	/** 展示的总组件数（collectionCount 的加和） */
	displayedTotalCount: number;
	/** 真实的总组件数（实际爬取到的） */
	actualTotalCount: number;
	/** Free 页面信息 */
	freePages: {
		/** Free 页面总数 */
		total: number;
		/** 具体的 Free 页面 */
		links: string[];
	};
	/** Free Block 信息 */
	freeBlocks: {
		/** Free Block 总数 */
		total: number;
		/** 具体的 Free Block */
		blockNames: string[];
	};
	/** 是否完整运行（未中断/未发生错误） */
	isComplete: boolean;
	/** 本次运行耗时（秒） */
	duration?: number;
	/** 本次运行开始时间 */
	startTime?: string;
}
