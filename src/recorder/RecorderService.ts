/**
 * Demo Maker - 录制服务
 * 负责录制流程的核心逻辑
 */

import { App, Modal, Notice, Setting } from 'obsidian';
import { FlowDefinition, FlowStep, ClickStep, InputStep, SelectStep, WaitStep, MessageStep, Locator } from '../core/types';
import { FlowManager } from '../core/FlowManager';
import { RecorderPanel } from './RecorderPanel';
import {
    findBestClickableElement,
    buildCssSelector,
    CLICKABLE_SELECTORS
} from '../core/LocatorUtils';

/**
 * 从元素构建定位器
 */
export function buildLocatorFromElement(rawElement: HTMLElement): Locator {
    // 首先找到最佳的可点击元素
    const element = findBestClickableElement(rawElement);

    const locator: Locator = {};

    // 尝试获取 aria-label
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) {
        locator.ariaLabel = ariaLabel;
    }

    // 尝试获取 data-type
    const dataType = element.getAttribute('data-type');
    if (dataType) {
        locator.dataType = dataType;
    }

    // 尝试获取 data-setting-id（设置页面中非常稳定的标识符）
    const settingId = element.getAttribute('data-setting-id') ||
        element.closest('[data-setting-id]')?.getAttribute('data-setting-id');
    if (settingId) {
        locator.settingId = settingId;
    }

    // 检测设置页控件上下文（用于 select/toggle/button 等控件）
    const settingContext = detectSettingContext(element);
    if (settingContext) {
        locator.settingName = settingContext.settingName;
        locator.controlType = settingContext.controlType;
    }

    // 获取文本内容（如果简短，且没有 settingContext）
    // 对于有 settingContext 的控件，textContent 通常不可靠
    if (!settingContext) {
        const textContent = element.textContent?.trim();
        if (textContent && textContent.length > 0 && textContent.length < 50) {
            locator.textContent = textContent;
        }
    }

    // 针对输入框捕获特定属性
    if (element.tagName.toLowerCase() === 'input' || element.tagName.toLowerCase() === 'textarea') {
        const placeholder = element.getAttribute('placeholder');
        if (placeholder) {
            locator.placeholder = placeholder;
        }
        const type = element.getAttribute('type');
        if (type) {
            locator.elementType = type;
        }
    }

    // 检测 SVG 图标特征（用于区分相似结构的图标按钮）
    const svgIconClass = detectSvgIconClass(element);

    // 构建 CSS 选择器（可能包含 :has() 用于精确匹配图标）
    locator.cssSelector = buildCssSelector(element, svgIconClass);

    // 构建人类可读描述
    locator.humanDescription = buildHumanDescription(element);

    return locator;
}

/**
 * 检测设置页控件的上下文信息
 */
export function detectSettingContext(element: HTMLElement): { settingName: string; controlType: 'select' | 'toggle' | 'button' | 'input' | 'slider' } | null {
    // 检查元素是否在 .setting-item 内
    const settingItem = element.closest('.setting-item');
    if (!settingItem) return null;

    // 获取设置项名称
    const nameEl = settingItem.querySelector('.setting-item-name');
    const settingName = nameEl?.textContent?.trim();
    if (!settingName) return null;

    // 检测控件类型
    const tag = element.tagName.toLowerCase();
    let controlType: 'select' | 'toggle' | 'button' | 'input' | 'slider';

    if (tag === 'select') {
        controlType = 'select';
    } else if (element.classList.contains('checkbox-container') || element.closest('.checkbox-container')) {
        controlType = 'toggle';
    } else if (tag === 'button') {
        controlType = 'button';
    } else if (tag === 'input') {
        const inputType = element.getAttribute('type');
        if (inputType === 'range') {
            controlType = 'slider';
        } else {
            controlType = 'input';
        }
    } else if (tag === 'slider' || element.classList.contains('slider')) {
        controlType = 'slider';
    } else {
        // 未知控件类型，不使用此策略
        return null;
    }

    return { settingName, controlType };
}

/**
 * 检测元素内部的 SVG 图标类名
 */
export function detectSvgIconClass(element: HTMLElement): string | null {
    const svg = element.querySelector('svg');
    if (!svg) return null;

    // 查找 lucide-* 类名
    for (const cls of Array.from(svg.classList)) {
        if (cls.startsWith('lucide-')) {
            return cls;
        }
    }

    // 查找其他常见图标类名模式
    for (const cls of Array.from(svg.classList)) {
        if (cls.includes('icon') || cls.includes('svg')) {
            return cls;
        }
    }

    return null;
}


/**
 * 构建人类可读描述
 */
export function buildHumanDescription(element: HTMLElement): string {
    const tag = element.tagName.toLowerCase();
    const ariaLabel = element.getAttribute('aria-label');
    const title = element.getAttribute('title');
    const text = element.textContent?.trim().slice(0, 30);
    const placeholder = element.getAttribute('placeholder');

    if (placeholder) return `输入框: "${placeholder}"`;
    if (ariaLabel) return ariaLabel;
    if (title) return title;
    if (text) return `${tag}: "${text}"`;

    return `${tag} 元素`;
}

/**
 * 流程命名弹窗
 */
class FlowNameModal extends Modal {
    private name = '';
    private description = '';
    private onSave: (name: string, description: string) => void;

    constructor(app: App, onSave: (name: string, description: string) => void) {
        super(app);
        this.onSave = onSave;
    }

    onOpen(): void {
        const { contentEl } = this;
        this.modalEl.addClass('demo-maker-modal');
        contentEl.empty();
        contentEl.createEl('h3', { text: '保存引导流程' });

        new Setting(contentEl)
            .setName('流程名称')
            .addText(text => {
                text.setPlaceholder('例如：Dataview 入门指南');
                text.onChange(value => this.name = value);
            });

        new Setting(contentEl)
            .setName('描述（可选）')
            .addTextArea(text => {
                text.setPlaceholder('简短描述这个流程的目的');
                text.onChange(value => this.description = value);
            });

        new Setting(contentEl)
            .addButton(btn => {
                btn.setButtonText('保存')
                    .setCta()
                    .onClick(() => {
                        if (!this.name.trim()) {
                            new Notice('请输入流程名称');
                            return;
                        }
                        this.onSave(this.name.trim(), this.description.trim());
                        this.close();
                    });
            })
            .addButton(btn => {
                btn.setButtonText('取消')
                    .onClick(() => this.close());
            });
    }

    onClose(): void {
        this.contentEl.empty();
    }
}

/**
 * 等待时间输入弹窗
 */
class WaitDurationModal extends Modal {
    private duration = 2;
    private onSave: (durationMs: number) => void;

    constructor(app: App, onSave: (durationMs: number) => void) {
        super(app);
        this.onSave = onSave;
    }

    onOpen(): void {
        const { contentEl } = this;
        this.modalEl.addClass('demo-maker-modal');
        contentEl.empty();
        contentEl.createEl('h3', { text: '插入等待步骤' });

        new Setting(contentEl)
            .setName('等待时间（秒）')
            .addText(text => {
                text.setValue('2');
                text.onChange(value => {
                    const num = parseInt(value);
                    this.duration = isNaN(num) ? 2 : num;
                });
            });

        new Setting(contentEl)
            .addButton(btn => {
                btn.setButtonText('确定')
                    .setCta()
                    .onClick(() => {
                        this.onSave(this.duration * 1000);
                        this.close();
                    });
            })
            .addButton(btn => {
                btn.setButtonText('取消')
                    .onClick(() => this.close());
            });
    }

    onClose(): void {
        this.contentEl.empty();
    }
}

/**
 * 消息内容输入弹窗
 */
class MessageContentModal extends Modal {
    private content = '';
    private onSave: (content: string) => void;

    constructor(app: App, onSave: (content: string) => void) {
        super(app);
        this.onSave = onSave;
    }

    onOpen(): void {
        const { contentEl } = this;
        this.modalEl.addClass('demo-maker-modal');
        contentEl.empty();
        contentEl.createEl('h3', { text: '插入提示步骤' });

        new Setting(contentEl)
            .setName('提示内容')
            .addTextArea(text => {
                text.setPlaceholder('输入要显示给用户的提示信息');
                text.onChange(value => this.content = value);
            });

        new Setting(contentEl)
            .addButton(btn => {
                btn.setButtonText('确定')
                    .setCta()
                    .onClick(() => {
                        if (!this.content.trim()) {
                            new Notice('请输入提示内容');
                            return;
                        }
                        this.onSave(this.content.trim());
                        this.close();
                    });
            })
            .addButton(btn => {
                btn.setButtonText('取消')
                    .onClick(() => this.close());
            });
    }

    onClose(): void {
        this.contentEl.empty();
    }
}

/**
 * 录制服务
 */
export class RecorderService {
    private app: App;
    private flowManager: FlowManager;
    private panel: RecorderPanel | null = null;
    private steps: FlowStep[] = [];
    private isRecording = false;
    private isPaused = false;
    private clickHandler: ((evt: MouseEvent) => void) | null = null;
    private changeHandler: ((evt: Event) => void) | null = null;
    private stepIdCounter = 0;

    constructor(app: App, flowManager: FlowManager) {
        this.app = app;
        this.flowManager = flowManager;
    }

    /**
     * 开始录制
     */
    start(): void {
        if (this.isRecording) {
            new Notice('已经在录制中');
            return;
        }

        this.steps = [];
        this.stepIdCounter = 0;
        this.isRecording = true;
        this.isPaused = false;

        // 创建面板
        this.panel = new RecorderPanel({
            onInsertWait: () => this.insertWaitStep(),
            onInsertMessage: () => this.insertMessageStep(),
            onFinish: () => this.finishRecording(),
            onCancel: () => this.cancelRecording(),
            onPause: () => this.pause(),
            onResume: () => this.resume(),
        });
        this.panel.show();

        // 绑定点击监听
        this.clickHandler = (evt: MouseEvent) => this.handleClick(evt);
        document.addEventListener('click', this.clickHandler, true);

        // 绑定 change 监听（用于 select 元素）
        this.changeHandler = (evt: Event) => this.handleChange(evt);
        document.addEventListener('change', this.changeHandler, true);

        new Notice('开始录制，点击界面元素生成步骤');
    }

    /**
     * 停止录制
     */
    stop(): void {
        if (!this.isRecording) return;

        this.isRecording = false;
        this.isPaused = false;

        if (this.clickHandler) {
            document.removeEventListener('click', this.clickHandler, true);
            this.clickHandler = null;
        }

        if (this.changeHandler) {
            document.removeEventListener('change', this.changeHandler, true);
            this.changeHandler = null;
        }

        if (this.panel) {
            this.panel.hide();
            this.panel = null;
        }

        this.steps = [];
    }

    /**
     * 是否正在录制
     */
    getIsRecording(): boolean {
        return this.isRecording;
    }

    /**
     * 暂停录制
     */
    private pause(): void {
        this.isPaused = true;
    }

    /**
     * 恢复录制
     */
    private resume(): void {
        this.isPaused = false;
    }

    /**
     * 处理点击事件
     */
    private handleClick(evt: MouseEvent): void {
        if (!this.isRecording || this.isPaused) return;

        const target = evt.target as HTMLElement;
        if (!target) return;

        // 忽略面板内的点击
        if (this.panel?.contains(target)) return;

        // 屏蔽插件自身的弹窗
        // 1. 通过类名屏蔽（最稳健）
        if (target.closest('.demo-maker-modal')) return;

        // 2. 忽略 select 元素（由 handleChange 处理）
        if (target.tagName.toLowerCase() === 'select') return;

        // 3. 兜底策略：通过标题关键词屏蔽（处理标题可能变化的情况）
        const modalContainer = target.closest('.modal-container');
        if (modalContainer) {
            const modalTitle = modalContainer.querySelector('h3, .modal-title');
            if (modalTitle) {
                const titleText = modalTitle.textContent || '';
                // 屏蔽所有带有插件关键特征标题的弹窗交互
                const blockedTitles = ['保存引导流程', '插入等待', '插入提示'];
                if (blockedTitles.some(t => titleText.includes(t))) {
                    return;
                }
            }
        }

        // 构建定位器
        const locator = buildLocatorFromElement(target);

        // 创建步骤
        let step: FlowStep;
        const tagName = target.tagName.toLowerCase();
        const type = target.getAttribute('type');

        // 检测是否是输入框（但排除 checkbox/radio，它们应该作为 click 处理）
        const isCheckboxOrRadio = tagName === 'input' && (type === 'checkbox' || type === 'radio');
        const isInput = (tagName === 'input' || tagName === 'textarea' || target.contentEditable === 'true') && !isCheckboxOrRadio;

        // 如果是 checkbox 或 radio 内部的点击，跳过（已经在点击 label 时录制过了）
        if (isCheckboxOrRadio && target.closest('.checkbox-container')) {
            return;
        }

        if (isInput) {
            // 如果是输入框，录制为 Input 步骤
            step = {
                id: this.generateStepId(),
                type: 'input',
                locator: {
                    ...locator,
                    humanDescription: locator.humanDescription || '在此处输入内容'
                },
            } as InputStep;
        } else {
            // 普通元素，录制为 Click 步骤
            step = {
                id: this.generateStepId(),
                type: 'click',
                locator,
            } as ClickStep;
        }

        this.steps.push(step);
        this.updatePanel();

        console.log('Demo Maker: 录制步骤', step);
    }

    /**
     * 处理 change 事件（用于 select 元素）
     */
    private handleChange(evt: Event): void {
        if (!this.isRecording || this.isPaused) return;

        const target = evt.target as HTMLElement;
        if (!target) return;

        // 屏蔽插件自身的弹窗
        if (target.closest('.demo-maker-modal')) return;

        // 只处理 select 元素
        if (target.tagName.toLowerCase() !== 'select') return;

        const selectEl = target as HTMLSelectElement;
        const selectedOption = selectEl.options[selectEl.selectedIndex];
        const expectedValue = selectedOption?.textContent?.trim() || '';

        if (!expectedValue) return;

        // 构建定位器
        const locator = buildLocatorFromElement(target);

        // 创建选择步骤
        const step: SelectStep = {
            id: this.generateStepId(),
            type: 'select',
            locator,
            expectedValue,
        };

        this.steps.push(step);
        this.updatePanel();

        console.log('Demo Maker: 录制选择步骤', step);
    }

    /**
     * 插入等待步骤
     */
    private insertWaitStep(): void {
        new WaitDurationModal(this.app, (durationMs) => {
            const step: WaitStep = {
                id: this.generateStepId(),
                type: 'wait',
                durationMs,
            };
            this.steps.push(step);
            this.updatePanel();
            new Notice(`已插入等待步骤: ${durationMs / 1000} 秒`);
        }).open();
    }

    /**
     * 插入消息步骤
     */
    private insertMessageStep(): void {
        new MessageContentModal(this.app, (content) => {
            const step: MessageStep = {
                id: this.generateStepId(),
                type: 'message',
                annotations: [{
                    id: `anno-${this.stepIdCounter}`,
                    type: 'text',
                    content,
                    position: {
                        anchor: 'screen',
                        placement: 'center',
                    },
                }],
            };
            this.steps.push(step);
            this.updatePanel();
            new Notice('已插入提示步骤');
        }).open();
    }

    /**
     * 完成录制
     */
    private finishRecording(): void {
        if (this.steps.length === 0) {
            new Notice('没有录制任何步骤');
            return;
        }

        new FlowNameModal(this.app, async (name, description) => {
            const flow = this.flowManager.createNewFlow(name, description);
            flow.steps = this.steps;

            const success = await this.flowManager.saveFlow(flow);
            if (success) {
                new Notice(`已保存流程: ${name} (${this.steps.length} 步)`);
            } else {
                new Notice('保存失败，请检查控制台');
            }

            this.stop();
        }).open();
    }

    /**
     * 取消录制
     */
    private cancelRecording(): void {
        new Notice('已取消录制');
        this.stop();
    }

    /**
     * 更新面板显示
     */
    private updatePanel(): void {
        this.panel?.updateStepCount(this.steps.length);
    }

    /**
     * 生成步骤 ID
     */
    private generateStepId(): string {
        this.stepIdCounter++;
        return `step-${this.stepIdCounter}`;
    }

    /**
     * 插件卸载时调用
     */
    onUnload(): void {
        this.stop();
    }
}
