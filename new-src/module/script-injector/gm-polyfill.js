// Tampermonkey API Polyfill for Playwright
// 为 Playwright 提供油猴 API 模拟支持
(function() {
    'use strict';
    
    // GM_xmlhttpRequest polyfill 使用 fetch 实现
    window.GM_xmlhttpRequest = function(details) {
        const {
            method = 'GET',
            url,
            headers = {},
            data,
            onload,
            onerror,
            ontimeout,
            timeout = 30000
        } = details;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
            if (ontimeout) ontimeout();
        }, timeout);

        const fetchOptions = {
            method: method,
            headers: headers,
            signal: controller.signal
        };

        if (data && (method === 'POST' || method === 'PUT')) {
            fetchOptions.body = data;
        }

        fetch(url, fetchOptions)
            .then(response => {
                clearTimeout(timeoutId);
                return response.text().then(text => ({
                    status: response.status,
                    statusText: response.statusText,
                    responseText: text,
                    response: text,
                    readyState: 4
                }));
            })
            .then(result => {
                if (onload) onload(result);
            })
            .catch(error => {
                clearTimeout(timeoutId);
                if (error.name === 'AbortError') {
                    if (ontimeout) ontimeout();
                } else {
                    if (onerror) onerror(error);
                }
            });
    };

    // 其他常用油猴 API
    window.GM_getValue = function(key, defaultValue) {
        const value = localStorage.getItem('GM_' + key);
        return value !== null ? JSON.parse(value) : defaultValue;
    };

    window.GM_setValue = function(key, value) {
        localStorage.setItem('GM_' + key, JSON.stringify(value));
    };

    window.GM_deleteValue = function(key) {
        localStorage.removeItem('GM_' + key);
    };

    window.GM_listValues = function() {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('GM_')) {
                keys.push(key.substring(3));
            }
        }
        return keys;
    };

    window.GM_info = {
        script: {
            name: 'UserScript via Playwright',
            version: '1.0'
        },
        scriptHandler: 'Playwright ScriptInjector',
        version: '1.0'
    };

    console.log('[GM] Tampermonkey API polyfill 已加载');
})();
