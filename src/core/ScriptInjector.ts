import type { Page } from "@playwright/test";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { InternalConfig } from "./ConfigManager";
import { createI18n, type I18n } from "../utils/i18n";

/**
 * 脚本注入器
 * 职责：处理脚本文件的读取和注入，支持油猴脚本格式
 */
export class ScriptInjector {
  private i18n: I18n;
  private scriptContents: Map<string, string> = new Map();
  private enabled: boolean;
  private timing: 'beforePageLoad' | 'afterPageLoad';

  constructor(private config: InternalConfig) {
    this.i18n = createI18n(config.locale);
    this.enabled = !!config.scriptInjection;
    this.timing = config.scriptInjection?.timing || 'afterPageLoad';

    // 预加载所有脚本内容
    if (this.enabled && config.scriptInjection) {
      this.loadScripts(config.scriptInjection.scripts);
    }
  }

  /**
   * 加载脚本文件内容并处理油猴脚本格式
   */
  private loadScripts(scriptNames: string[]): void {
    const scriptsDir = this.config.stateDir; // .crawler/域名/

    for (const scriptName of scriptNames) {
      const scriptPath = join(scriptsDir, scriptName);
      
      if (!existsSync(scriptPath)) {
        console.warn(this.i18n.t('script.notFound', { path: scriptPath }));
        continue;
      }

      try {
        const rawContent = readFileSync(scriptPath, 'utf-8');
        // 处理油猴脚本格式，提取实际执行代码
        const processedContent = this.processUserScript(rawContent);
        this.scriptContents.set(scriptName, processedContent);
        console.log(this.i18n.t('script.loaded', { name: scriptName }));
      } catch (error) {
        console.error(this.i18n.t('script.loadError', { name: scriptName, error: String(error) }));
      }
    }
  }

  /**
   * 处理油猴脚本格式
   * - 去除元数据注释
   * - 注入油猴API的polyfill
   */
  private processUserScript(content: string): string {
    // 检测是否为油猴脚本
    const isUserScript = content.includes('// ==UserScript==');
    
    if (!isUserScript) {
      // 普通脚本，直接返回
      return content;
    }

    // 提取实际执行代码（去除元数据）
    const metadataEndIndex = content.indexOf('// ==/UserScript==');
    const scriptCode = metadataEndIndex !== -1 
      ? content.substring(metadataEndIndex + '// ==/UserScript=='.length).trim()
      : content;

    // 包装脚本：注入油猴API polyfill + 执行代码
    return this.wrapWithGreasemonkeyAPI(scriptCode);
  }

  /**
   * 创建油猴API的polyfill
   */
  private wrapWithGreasemonkeyAPI(scriptCode: string): string {
    return `
(function() {
  // ============================================
  // Greasemonkey API Polyfill for Playwright
  // ============================================
  
  // 存储数据（使用 sessionStorage 模拟）
  const GM_getValue = function(key, defaultValue) {
    try {
      const value = window.sessionStorage.getItem('GM_' + key);
      return value !== null ? JSON.parse(value) : defaultValue;
    } catch {
      return defaultValue;
    }
  };

  const GM_setValue = function(key, value) {
    try {
      window.sessionStorage.setItem('GM_' + key, JSON.stringify(value));
    } catch (e) {
      console.error('GM_setValue failed:', e);
    }
  };

  const GM_deleteValue = function(key) {
    try {
      window.sessionStorage.removeItem('GM_' + key);
    } catch (e) {
      console.error('GM_deleteValue failed:', e);
    }
  };

  const GM_listValues = function() {
    try {
      const keys = [];
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const key = window.sessionStorage.key(i);
        if (key && key.startsWith('GM_')) {
          keys.push(key.substring(3));
        }
      }
      return keys;
    } catch {
      return [];
    }
  };

  // 添加样式
  const GM_addStyle = function(css) {
    try {
      const style = document.createElement('style');
      style.textContent = css;
      (document.head || document.documentElement).appendChild(style);
      return style;
    } catch (e) {
      console.error('GM_addStyle failed:', e);
    }
  };

  // 网络请求（使用原生 fetch 实现）
  const GM_xmlhttpRequest = function(details) {
    const {
      method = 'GET',
      url,
      headers = {},
      data,
      onload,
      onerror,
      ontimeout,
      timeout
    } = details;

    const controller = new AbortController();
    const timeoutId = timeout ? setTimeout(() => {
      controller.abort();
      if (ontimeout) ontimeout();
    }, timeout) : null;

    fetch(url, {
      method,
      headers,
      body: data,
      signal: controller.signal
    })
      .then(response => response.text().then(responseText => ({
        status: response.status,
        statusText: response.statusText,
        responseText,
        response: responseText
      })))
      .then(result => {
        if (timeoutId) clearTimeout(timeoutId);
        if (onload) onload(result);
      })
      .catch(error => {
        if (timeoutId) clearTimeout(timeoutId);
        if (error.name !== 'AbortError' && onerror) {
          onerror(error);
        }
      });
  };

  // 其他常用API
  const GM_info = {
    script: { name: 'UserScript', version: '1.0' },
    scriptMetaStr: '',
    scriptHandler: 'Playwright',
    version: '1.0'
  };

  const GM_log = console.log.bind(console);
  const unsafeWindow = window;

  // 将API注入到全局作用域
  window.GM_getValue = GM_getValue;
  window.GM_setValue = GM_setValue;
  window.GM_deleteValue = GM_deleteValue;
  window.GM_listValues = GM_listValues;
  window.GM_addStyle = GM_addStyle;
  window.GM_xmlhttpRequest = GM_xmlhttpRequest;
  window.GM_info = GM_info;
  window.GM_log = GM_log;
  window.unsafeWindow = unsafeWindow;

  // ============================================
  // 执行用户脚本
  // ============================================
  ${scriptCode}
})();
`;
  }

  /**
   * 检查是否启用了脚本注入
   */
  isEnabled(): boolean {
    return this.enabled && this.scriptContents.size > 0;
  }

  /**
   * 获取注入时机
   */
  getTiming(): 'beforePageLoad' | 'afterPageLoad' {
    return this.timing;
  }

  /**
   * 在页面加载前注入脚本（使用 addInitScript）
   * 适用于需要在页面加载前执行的脚本
   */
  async injectBeforePageLoad(page: Page): Promise<void> {
    if (!this.isEnabled() || this.timing !== 'beforePageLoad') {
      return;
    }

    for (const [scriptName, content] of this.scriptContents) {
      try {
        await page.addInitScript(content);
        console.log(this.i18n.t('script.injectedBefore', { name: scriptName }));
      } catch (error) {
        console.error(this.i18n.t('script.injectError', { name: scriptName, error: String(error) }));
      }
    }
  }

  /**
   * 在页面加载后注入脚本
   * 适用于需要在页面加载完成后执行的脚本
   */
  async injectAfterPageLoad(page: Page): Promise<void> {
    if (!this.isEnabled() || this.timing !== 'afterPageLoad') {
      return;
    }

    for (const [scriptName, content] of this.scriptContents) {
      try {
        await page.evaluate(content);
        console.log(this.i18n.t('script.injectedAfter', { name: scriptName }));
      } catch (error) {
        console.error(this.i18n.t('script.injectError', { name: scriptName, error: String(error) }));
      }
    }
  }

  /**
   * 统一注入接口（根据配置的时机自动选择）
   * @param page 页面对象
   * @param beforeLoad 是否在页面加载前调用（true 表示在 goto 前，false 表示在 goto 后）
   */
  async inject(page: Page, beforeLoad: boolean): Promise<void> {
    if (beforeLoad) {
      await this.injectBeforePageLoad(page);
    } else {
      await this.injectAfterPageLoad(page);
    }
  }
}

