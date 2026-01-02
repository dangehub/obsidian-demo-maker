/**
 * Demo Maker - 元素定位引擎
 * 多策略定位，优先使用语义化属性
 */

import { Locator, LocatorContext } from './types';

/**
 * 定位结果
 */
export interface LocateResult {
    /** 找到的元素 */
    element: HTMLElement | null;
    /** 使用的定位策略 */
    strategy: string;
    /** 是否成功 */
    success: boolean;
    /** 错误信息 */
    error?: string;
}

/**
 * 检查上下文是否匹配
 */
function checkContext(context: LocatorContext): boolean {
    // 检查是否在 Modal 中
    if (context.modal !== undefined) {
        const hasModal = document.querySelector('.modal-container') !== null;
        if (context.modal !== hasModal) return false;
    }

    // 检查 Modal 类名
    if (context.modalClass) {
        const modal = document.querySelector(`.modal-container .${context.modalClass}`);
        if (!modal) return false;
    }

    // 检查设置页标签
    if (context.settingsTab) {
        const activeTab = document.querySelector('.vertical-tab-content.active');
        if (!activeTab) return false;
        // 这里可以进一步检查标签名
    }

    return true;
}

/**
 * 通过 aria-label 定位
 */
function locateByAriaLabel(ariaLabel: string): HTMLElement | null {
    return document.querySelector(`[aria-label="${CSS.escape(ariaLabel)}"]`);
}

/**
 * 通过 data-type 定位
 */
function locateByDataType(dataType: string): HTMLElement | null {
    return document.querySelector(`[data-type="${CSS.escape(dataType)}"]`);
}

/**
 * 通过精确文本内容定位
 */
function locateByTextContent(text: string): HTMLElement | null {
    const normalizedText = text.trim();

    // 先在整个文档中搜索
    const searchIn = (container: Document | Element): HTMLElement | null => {
        // 搜索所有可能包含文本的元素
        const candidates = container.querySelectorAll(
            'button, a, span, div, li, label, p, h1, h2, h3, h4, h5, h6, ' +
            '[role="button"], [role="menuitem"], [role="tab"], ' +
            '.vertical-tab-nav-item, .setting-item-name, .menu-item'
        );

        for (const el of Array.from(candidates)) {
            const elText = (el.textContent || '').trim();
            // 精确匹配（保持原始大小写）
            if (elText === normalizedText) {
                return el as HTMLElement;
            }
        }

        // 如果精确匹配失败，尝试忽略大小写
        for (const el of Array.from(candidates)) {
            const elText = (el.textContent || '').trim().toLowerCase();
            if (elText === normalizedText.toLowerCase()) {
                return el as HTMLElement;
            }
        }

        return null;
    };

    // 先在 Modal 内搜索（如果存在）
    const modal = document.querySelector('.modal-container');
    if (modal) {
        const result = searchIn(modal);
        if (result) return result;
    }

    // 再在整个文档中搜索
    return searchIn(document);
}

/**
 * 通过包含文本定位
 */
function locateByTextContains(text: string): HTMLElement | null {
    const normalizedText = text.trim().toLowerCase();

    const candidates = document.querySelectorAll('button, a, span, div, li, [role="button"], [role="menuitem"]');

    for (const el of Array.from(candidates)) {
        const elText = (el.textContent || '').trim().toLowerCase();
        if (elText.includes(normalizedText)) {
            return el as HTMLElement;
        }
    }

    return null;
}

/**
 * 通过 CSS 选择器定位
 */
function locateByCssSelector(selector: string): HTMLElement | null {
    try {
        return document.querySelector(selector);
    } catch (e) {
        console.warn('Demo Maker: 无效的 CSS 选择器', selector, e);
        return null;
    }
}

/**
 * 通过设置项 ID 定位
 * 支持 data-setting-id 和 data-id 两种属性
 */
function locateBySettingId(settingId: string): HTMLElement | null {
    // 优先尝试 data-setting-id（Obsidian 设置页面使用）
    let el = document.querySelector(`[data-setting-id="${CSS.escape(settingId)}"]`);
    if (el) return el as HTMLElement;

    // 降级尝试 data-id
    el = document.querySelector(`[data-id="${CSS.escape(settingId)}"]`);
    return el as HTMLElement | null;
}

/**
 * 通过设置项名称和控件类型定位
 * 用于定位设置页面中的 select/toggle/button 等控件
 */
function locateBySettingName(
    settingName: string,
    controlType?: 'select' | 'toggle' | 'button' | 'input' | 'slider'
): HTMLElement | null {
    // 获取搜索范围（优先在 Modal 内搜索）
    const searchRoot = document.querySelector('.modal-container') || document;

    // 查找所有设置项
    const settingItems = searchRoot.querySelectorAll('.setting-item');

    for (const item of Array.from(settingItems)) {
        const nameEl = item.querySelector('.setting-item-name');
        const name = nameEl?.textContent?.trim();

        if (name === settingName) {
            // 找到匹配的设置项，现在在其中查找控件
            const controlEl = item.querySelector('.setting-item-control');
            if (!controlEl) continue;

            if (controlType === 'select') {
                const select = controlEl.querySelector('select');
                if (select) return select as HTMLElement;
            } else if (controlType === 'toggle') {
                const toggle = controlEl.querySelector('.checkbox-container');
                if (toggle) return toggle as HTMLElement;
            } else if (controlType === 'button') {
                const button = controlEl.querySelector('button');
                if (button) return button as HTMLElement;
            } else if (controlType === 'input') {
                const input = controlEl.querySelector('input:not([type="range"])');
                if (input) return input as HTMLElement;
            } else if (controlType === 'slider') {
                const slider = controlEl.querySelector('input[type="range"]');
                if (slider) return slider as HTMLElement;
            } else {
                // 如果没有指定类型，返回第一个交互元素
                const anyControl = controlEl.querySelector('select, button, input, .checkbox-container');
                if (anyControl) return anyControl as HTMLElement;
            }
        }
    }

    return null;
}

/**
 * 通过输入框属性定位
 */
function locateByInputAttributes(placeholder?: string, elementType?: string): HTMLElement | null {
    if (!placeholder && !elementType) return null;

    // 优先在 Modal 内搜索
    const root = document.querySelector('.modal-container') || document;
    let selector = '';

    if (placeholder && elementType) {
        selector = `input[placeholder="${CSS.escape(placeholder)}"][type="${CSS.escape(elementType)}"], textarea[placeholder="${CSS.escape(placeholder)}"]`;
    } else if (placeholder) {
        selector = `input[placeholder="${CSS.escape(placeholder)}"], textarea[placeholder="${CSS.escape(placeholder)}"]`;
    } else if (elementType) {
        selector = `input[type="${CSS.escape(elementType)}"]`;
    }

    if (!selector) return null;
    return root.querySelector(selector) as HTMLElement | null;
}

/**
 * 解析元素定位器，返回对应的 DOM 元素
 */
export function resolveLocator(locator: Locator, debug = false): LocateResult {
    const log = debug ? console.log.bind(console, '[Demo Maker Debug]') : () => { };

    log('开始定位元素:', locator);

    // 检查上下文条件
    if (locator.context && !checkContext(locator.context)) {
        log('❌ 上下文条件不满足');
        return {
            element: null,
            strategy: 'context',
            success: false,
            error: '上下文条件不满足',
        };
    }

    // 策略 1: aria-label
    if (locator.ariaLabel) {
        log('尝试 ariaLabel:', locator.ariaLabel);
        const el = locateByAriaLabel(locator.ariaLabel);
        if (el) {
            log('✅ ariaLabel 成功', el);
            return { element: el, strategy: 'ariaLabel', success: true };
        }
        log('❌ ariaLabel 失败');
    }

    // 策略 2: data-type
    if (locator.dataType) {
        log('尝试 dataType:', locator.dataType);
        const el = locateByDataType(locator.dataType);
        if (el) {
            log('✅ dataType 成功', el);
            return { element: el, strategy: 'dataType', success: true };
        }
        log('❌ dataType 失败');
    }

    // 策略 3: setting-id
    if (locator.settingId) {
        log('尝试 settingId:', locator.settingId);
        const el = locateBySettingId(locator.settingId);
        if (el) {
            log('✅ settingId 成功', el);
            return { element: el, strategy: 'settingId', success: true };
        }
        log('❌ settingId 失败');
    }

    // 策略 4: settingName + controlType（设置页控件定位）
    if (locator.settingName) {
        log('尝试 settingName:', locator.settingName, 'controlType:', locator.controlType);
        const el = locateBySettingName(locator.settingName, locator.controlType);
        if (el) {
            log('✅ settingName 成功', el);
            return { element: el, strategy: 'settingName', success: true };
        }
        log('❌ settingName 失败');
    }

    // 策略 4.5: 输入框属性定位 (placeholder/type)
    if (locator.placeholder || locator.elementType) {
        log('尝试 inputAttributes:', 'placeholder:', locator.placeholder, 'type:', locator.elementType);
        const el = locateByInputAttributes(locator.placeholder, locator.elementType);
        if (el) {
            log('✅ inputAttributes 成功', el);
            return { element: el, strategy: 'inputAttributes', success: true };
        }
        log('❌ inputAttributes 失败');
    }

    // 策略 5: 精确文本
    if (locator.textContent) {
        log('尝试 textContent:', locator.textContent);
        const el = locateByTextContent(locator.textContent);
        if (el) {
            log('✅ textContent 成功', el);
            return { element: el, strategy: 'textContent', success: true };
        }
        log('❌ textContent 失败');
    }

    // 策略 5: 包含文本
    if (locator.textContains) {
        log('尝试 textContains:', locator.textContains);
        const el = locateByTextContains(locator.textContains);
        if (el) {
            log('✅ textContains 成功', el);
            return { element: el, strategy: 'textContains', success: true };
        }
        log('❌ textContains 失败');
    }

    // 策略 6: CSS 选择器（降级）
    if (locator.cssSelector) {
        log('尝试 cssSelector:', locator.cssSelector);
        const el = locateByCssSelector(locator.cssSelector);
        if (el) {
            log('✅ cssSelector 成功', el);
            return { element: el, strategy: 'cssSelector', success: true };
        }
        log('❌ cssSelector 失败');
    }

    log('❌ 所有策略都失败');

    // 所有策略都失败
    return {
        element: null,
        strategy: 'none',
        success: false,
        error: locator.humanDescription
            ? `无法定位元素: ${locator.humanDescription}`
            : '无法定位元素',
    };
}

/**
 * 轮询定位元素（用于动态出现的元素）
 */
export function pollLocator(
    locator: Locator,
    options: {
        maxAttempts?: number;
        intervalMs?: number;
        debug?: boolean;
    } = {}
): Promise<LocateResult> {
    const { maxAttempts = 20, intervalMs = 200, debug = false } = options;

    return new Promise((resolve) => {
        let attempts = 0;

        const tryLocate = () => {
            attempts++;
            // 只在最后一次尝试时输出详细日志
            const shouldDebug = debug && attempts === maxAttempts;
            const result = resolveLocator(locator, shouldDebug);

            if (result.success) {
                if (debug) {
                    console.log(`[Demo Maker] 定位成功 (第 ${attempts} 次尝试)`, result.strategy);
                }
                resolve(result);
                return;
            }

            if (attempts >= maxAttempts) {
                if (debug) {
                    console.log(`[Demo Maker] 定位失败，已尝试 ${attempts} 次`);
                }
                resolve(result);
                return;
            }

            setTimeout(tryLocate, intervalMs);
        };

        tryLocate();
    });
}
