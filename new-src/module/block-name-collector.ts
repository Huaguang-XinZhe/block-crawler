import fse from "fs-extra";

const CRAWLER_DIR = ".crawler";

interface BlockNameEntry {
	name: string;
	level?: string;
}

interface BlockNameOutput {
	blockNames: string[] | BlockNameEntry[];
	total: number;
	levelStats?: Record<string, number>;
}

interface BlockNameCollectorOptions {
	/** 域名，必填 */
	domain: string;
	/** 自定义 blockName 转换函数，默认转小写去空格 */
	transform?: (name: string) => string;
	/** 是否持久化，默认 true */
	persist?: boolean;
}

/** 默认转换：小写 + 去除空格 */
const defaultTransform = (name: string) =>
	name.toLowerCase().replace(/\s+/g, "");

/** 获取 block-names.json 的路径 */
const getFilePath = (domain: string) =>
	`${CRAWLER_DIR}/${domain}/block-names.json`;

export class BlockNameCollector {
	private names = new Set<string>();
	private entries: BlockNameEntry[] = [];
	private hasLevel = false;

	private domain: string;
	private transform: (name: string) => string;
	private persist: boolean;

	constructor(options: BlockNameCollectorOptions) {
		this.domain = options.domain;
		this.transform = options.transform ?? defaultTransform;
		this.persist = options.persist ?? true;
	}

	/**
	 * 添加 blockName
	 * @param name - 原始 blockName
	 * @param level - 可选，所属级别（如 Basic/Pro）
	 */
	add(name: string, level?: string) {
		const transformed = this.transform(name);
		this.names.add(transformed);

		if (level !== undefined) {
			this.hasLevel = true;
			this.entries.push({ name: transformed, level });
		}
	}

	/** 获取当前收集的数量 */
	get size() {
		return this.names.size;
	}

	/** 获取所有 blockNames（转换后） */
	getAll(): string[] {
		return Array.from(this.names);
	}

	/** 保存到文件 */
	async save() {
		if (!this.persist) return;

		const output: BlockNameOutput = this.hasLevel
			? {
					blockNames: this.entries,
					total: this.entries.length,
					levelStats: this.entries.reduce(
						(acc, entry) => {
							acc[entry.level!] = (acc[entry.level!] || 0) + 1;
							return acc;
						},
						{} as Record<string, number>,
					),
				}
			: {
					blockNames: Array.from(this.names),
					total: this.names.size,
				};

		await fse.outputFile(
			getFilePath(this.domain),
			JSON.stringify(output, null, 2),
		);
	}

	/**
	 * 从文件加载 blockNames（使用实例的 domain）
	 * @param level - 可选，指定级别过滤（如 "Basic" / "Pro"）
	 */
	async loadNames(level?: string): Promise<string[]> {
		return BlockNameCollector.load(this.domain, level);
	}

	/**
	 * 静态方法：从文件加载 blockNames
	 * @param domain - 域名
	 * @param level - 可选，指定级别过滤（如 "Basic" / "Pro"）
	 * @returns blockName 列表
	 */
	static async load(domain: string, level?: string): Promise<string[]> {
		const filepath = getFilePath(domain);
		if (!(await fse.pathExists(filepath))) return [];

		const data: BlockNameOutput = await fse.readJson(filepath);
		if (!Array.isArray(data.blockNames)) return [];

		return data.blockNames
			.filter((item: string | BlockNameEntry) => {
				if (level === undefined) return true;
				return typeof item !== "string" && item.level === level;
			})
			.map((item: string | BlockNameEntry) =>
				typeof item === "string" ? item : item.name,
			);
	}
}
