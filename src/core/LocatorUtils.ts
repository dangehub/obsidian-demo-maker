/**
 * 可点击元素的选择器列表
 */
export const CLICKABLE_SELECTORS = [
    'button',
    'a',
    '[role="button"]',
    '[role="menuitem"]',
    '[role="tab"]',
    '.clickable-icon',
    '.nav-action-button',
    '.vertical-tab-nav-item',
    '.menu-item',
    '.setting-item-control > *',
];

/**
 * 向上查找最合适的可点击元素
 */
export function findBestClickableElement(element: HTMLElement): HTMLElement {
    const tagName = element.tagName.toLowerCase();
    if (tagName === 'button' || tagName === 'a' || tagName === 'select' || tagName === 'input') {
        return element;
    }

    if (tagName === 'svg' || tagName === 'path' || tagName === 'circle' || tagName === 'rect' || tagName === 'line') {
        for (const selector of CLICKABLE_SELECTORS) {
            const parent = element.closest(selector);
            if (parent && parent instanceof HTMLElement) {
                return parent;
            }
        }
        const svgParent = element.closest('svg')?.parentElement;
        if (svgParent) {
            return svgParent;
        }
    }

    for (const selector of CLICKABLE_SELECTORS) {
        const parent = element.closest(selector);
        if (parent && parent instanceof HTMLElement && parent !== element) {
            let depth = 0;
            let current: HTMLElement | null = element;
            while (current && current !== parent && depth < 3) {
                current = current.parentElement;
                depth++;
            }
            if (depth < 3) {
                return parent;
            }
        }
    }

    return element;
}

/**
 * 构建 CSS 选择器
 */
export function buildCssSelector(element: HTMLElement, svgIconClass?: string | null): string {
    const parts: string[] = [];
    let current: HTMLElement | null = element;
    let depth = 0;
    let isFirstElement = true;

    while (current && depth < 4 && current !== document.body) {
        const tag = current.tagName.toLowerCase();

        if (current.id) {
            parts.unshift(`#${CSS.escape(current.id)}`);
            break;
        }

        const meaningfulClasses = Array.from(current.classList)
            .filter(c => !c.startsWith('cm-') && !c.match(/^[a-z]{20,}$/))
            .slice(0, 2);

        if (meaningfulClasses.length > 0) {
            let classSelector = meaningfulClasses.map(c => `.${CSS.escape(c)}`).join('');

            if (isFirstElement && svgIconClass) {
                classSelector += `:has(.${CSS.escape(svgIconClass)})`;
            }

            if (isFirstElement && (tag === 'input' || tag === 'textarea')) {
                const placeholder = current.getAttribute('placeholder');
                const type = current.getAttribute('type');
                if (placeholder) {
                    classSelector += `[placeholder="${CSS.escape(placeholder)}"]`;
                } else if (type) {
                    classSelector += `[type="${CSS.escape(type)}"]`;
                }
            }

            parts.unshift(`${tag}${classSelector}`);
        } else {
            if (isFirstElement && (tag === 'input' || tag === 'textarea')) {
                const placeholder = current.getAttribute('placeholder');
                const type = current.getAttribute('type');
                if (placeholder) {
                    parts.unshift(`${tag}[placeholder="${CSS.escape(placeholder)}"]`);
                    current = current.parentElement;
                    depth++;
                    isFirstElement = false;
                    continue;
                } else if (type) {
                    parts.unshift(`${tag}[type="${CSS.escape(type)}"]`);
                    current = current.parentElement;
                    depth++;
                    isFirstElement = false;
                    continue;
                }
            }

            const siblings: HTMLCollection | undefined = current.parentElement?.children;
            if (siblings) {
                let index = 1;
                for (let i = 0; i < siblings.length; i++) {
                    const sibling: Element = siblings[i];
                    if (sibling === current) break;
                    if (sibling.tagName === current.tagName) index++;
                }
                parts.unshift(`${tag}:nth-of-type(${index})`);
            } else {
                parts.unshift(tag);
            }
        }

        current = current.parentElement;
        depth++;
        isFirstElement = false;
    }

    return parts.join(' > ');
}
