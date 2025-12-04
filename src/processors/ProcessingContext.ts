/**
 * 处理上下文
 * 用于在处理过程中缓存和共享运行时信息
 */
export class ProcessingContext {
	/** 变种名称缓存（按 buttonLocator 哈希缓存） */
	private variantNamesCache = new Map<string, string[]>();

	/** Free block 检查策略缓存 */
	private freeCheckStrategy:
		| "heading"
		| "container"
		| "grandparent"
		| null = null;

	/** Code 元素的角色类型缓存（首次检测后缓存） */
	private codeRole: "tab" | "button" | null = null;

	/**
	 * 获取缓存的变种名称列表
	 * @param cacheKey 缓存键（通常是配置的哈希或索引）
	 */
	getVariantNames(cacheKey: string): string[] | undefined {
		return this.variantNamesCache.get(cacheKey);
	}

	/**
	 * 设置变种名称缓存
	 * @param cacheKey 缓存键
	 * @param names 变种名称列表
	 */
	setVariantNames(cacheKey: string, names: string[]): void {
		this.variantNamesCache.set(cacheKey, names);
	}

	/**
	 * 获取 Free block 检查策略
	 */
	getFreeCheckStrategy(): "heading" | "container" | "grandparent" | null {
		return this.freeCheckStrategy;
	}

	/**
	 * 设置 Free block 检查策略
	 * @param strategy 检查策略
	 */
	setFreeCheckStrategy(
		strategy: "heading" | "container" | "grandparent",
	): void {
		this.freeCheckStrategy = strategy;
	}

	/**
	 * 获取 Code 元素的角色类型
	 */
	getCodeRole(): "tab" | "button" | null {
		return this.codeRole;
	}

	/**
	 * 设置 Code 元素的角色类型
	 * @param role 角色类型（"tab" 或 "button"）
	 */
	setCodeRole(role: "tab" | "button"): void {
		this.codeRole = role;
	}

	/**
	 * 清空所有缓存
	 */
	clear(): void {
		this.variantNamesCache.clear();
		this.freeCheckStrategy = null;
		this.codeRole = null;
	}
}
