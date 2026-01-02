/**
 * Demo Maker - 播放服务
 * 负责流程播放逻辑
 */

import { Notice, Plugin } from 'obsidian';
import { FlowDefinition, FlowStep, ClickStep, InputStep, SelectStep, MessageStep } from '../core/types';
import { resolveLocator, pollLocator, LocateResult } from '../core/Locator';
import { Overlay } from './Overlay';
import { EditorService } from '../editor/EditorService';
import { FlowManager } from '../core/FlowManager';

/**
 * 播放状态
 */
export type PlayerState = 'idle' | 'playing' | 'paused';

/**
 * 播放事件
 */
export interface PlayerEvents {
    onStart?: (flow: FlowDefinition) => void;
    onEnd?: (flow: FlowDefinition, completed: boolean) => void;
    onStepChange?: (step: FlowStep, index: number) => void;
}

/**
 * 播放服务
 */
export class PlayerService {
    private plugin: Plugin;
    private overlay: Overlay | null = null;
    private flow: FlowDefinition | null = null;
    private currentIndex = 0;
    private state: PlayerState = 'idle';
    private events: PlayerEvents = {};
    private editor: EditorService;

    private clickHandler: ((evt: MouseEvent) => void) | null = null;
    private keyHandler: ((evt: KeyboardEvent) => void) | null = null;
    private selectChangeHandler: ((evt: Event) => void) | null = null;
    private waitTimeout: number | null = null;
    private pollTimeout: number | null = null;

    private currentTarget: HTMLElement | null = null;

    constructor(plugin: Plugin, events?: PlayerEvents) {
        this.plugin = plugin;
        this.events = events || {};
        this.editor = new EditorService(plugin.app);
    }

    /**
     * 获取当前状态
     */
    getState(): PlayerState {
        return this.state;
    }

    /**
     * 是否正在播放
     */
    isPlaying(): boolean {
        return this.state === 'playing';
    }

    /**
     * 开始播放流程
     */
    async start(flow: FlowDefinition): Promise<void> {
        if (this.state !== 'idle') {
            this.stop();
        }

        this.flow = flow;
        this.currentIndex = 0;
        this.state = 'playing';

        // 创建遮罩层
        this.overlay = new Overlay(this.plugin, {
            onExit: () => this.stop(),
            onNext: () => this.handleNext(),
            onEdit: () => this.handleEdit(),
            onAnnotationChange: (anno) => this.editor.handleAnnotationDrag(anno),
            onDeleteAnnotation: (id) => {
                if (this.editor.isEditing()) {
                    (this.editor as any).panel?.deleteAnnotation(id);
                }
            },
            onAnnotationContentChange: (id, content) => {
                if (this.editor.isEditing()) {
                    (this.editor as any).panel?.updateAnnotationContent(id, content);
                }
            }
        });
        this.overlay.show();

        // 绑定事件监听
        this.bindListeners();

        // 触发事件
        this.events.onStart?.(flow);

        // 显示第一步
        await this.showCurrentStep();
    }

    /**
     * 进入编辑模式
     */
    private handleEdit(): void {
        if (!this.flow || this.state !== 'playing') return;

        const currentStep = this.flow.steps[this.currentIndex];
        this.state = 'paused';

        // 告知遮罩层进入编辑模式（显示拖拽点）
        this.overlay?.setEditingMode(true);
        this.overlay?.renderStep(currentStep, this.currentTarget, this.currentIndex + 1, this.flow.steps.length);

        this.editor.startEditing(currentStep, {
            onSave: async (updatedStep) => {
                if (this.flow) {
                    this.flow.steps[this.currentIndex] = updatedStep;
                    // 持久化到文件
                    const fm = new FlowManager(this.plugin);
                    await fm.saveFlow(this.flow);
                    new Notice('步骤已保存');
                }
                this.overlay?.setEditingMode(false);
                this.state = 'playing';
                // 重新渲染当前步以应用更改
                this.currentTarget = null;
                await this.showCurrentStep();
            },
            onCancel: () => {
                this.overlay?.setEditingMode(false);
                this.state = 'playing';
                this.showCurrentStep(); // 恢复原始显示
            },
            onPreview: async (updatedStep) => {
                if (this.overlay) {
                    this.overlay.renderStep(
                        updatedStep,
                        this.currentTarget,
                        this.currentIndex + 1,
                        this.flow?.steps.length || 0
                    );
                }
            },
            onPickingModeChange: (active: boolean) => {
                this.overlay?.setPickingMode(active);
            }
        });
    }

    /**
     * 停止播放
     */
    stop(message?: string): void {
        if (this.state === 'idle') return;

        const wasPlaying = this.flow;
        const completed = this.flow ? this.currentIndex >= this.flow.steps.length : false;

        this.clearTimers();
        this.unbindListeners();

        if (this.overlay) {
            this.overlay.hide();
            this.overlay = null;
        }

        this.flow = null;
        this.currentIndex = 0;
        this.state = 'idle';
        this.currentTarget = null;

        if (wasPlaying) {
            this.events.onEnd?.(wasPlaying, completed);
        }

        if (message) {
            new Notice(message);
        }
    }

    /**
     * 进入下一步
     */
    next(): void {
        if (this.state !== 'playing' || !this.flow) return;

        this.currentIndex++;

        if (this.currentIndex >= this.flow.steps.length) {
            this.stop('🎉 引导完成！');
            return;
        }

        this.showCurrentStep();
    }

    /**
     * 返回上一步
     */
    prev(): void {
        if (this.state !== 'playing' || !this.flow) return;
        if (this.currentIndex <= 0) return;

        this.currentIndex--;
        this.showCurrentStep();
    }

    /**
     * 显示当前步骤
     */
    private async showCurrentStep(): Promise<void> {
        if (!this.flow || !this.overlay) return;

        this.clearTimers();
        this.currentTarget = null;

        const step = this.flow.steps[this.currentIndex];
        const total = this.flow.steps.length;

        this.events.onStepChange?.(step, this.currentIndex);

        // 根据步骤类型处理
        switch (step.type) {
            case 'click':
            case 'input':
                await this.handleTargetStep(step);
                break;
            case 'select':
                await this.handleSelectStep(step);
                break;
            case 'wait':
                this.handleWaitStep(step);
                break;
            case 'message':
                await this.handleMessageStep(step);
                break;
        }
    }

    /**
     * 处理需要定位目标的步骤（click/input）
     */
    private async handleTargetStep(step: ClickStep | InputStep): Promise<void> {
        if (!this.overlay || !this.flow) return;

        // 轮询定位元素（启用调试输出）
        const result = await pollLocator(step.locator, {
            maxAttempts: 20,
            intervalMs: 200,
            debug: true,
        });

        if (result.success && result.element) {
            // 如果元素不在视口内，自动滚动到可见位置
            await this.scrollElementIntoViewIfNeeded(result.element);

            this.currentTarget = result.element;
            await this.overlay.renderStep(
                step,
                result.element,
                this.currentIndex + 1,
                this.flow.steps.length
            );
        } else {
            // 定位失败
            console.warn('Demo Maker: 无法定位元素', step.locator);
            await this.overlay.renderStep(
                step,
                null,
                this.currentIndex + 1,
                this.flow.steps.length
            );

            // 显示降级提示
            if (step.locator.humanDescription) {
                new Notice(`请手动找到: ${step.locator.humanDescription}`);
            }
        }
    }

    /**
     * 处理选择步骤（下拉选单）
     */
    private async handleSelectStep(step: SelectStep): Promise<void> {
        if (!this.overlay || !this.flow) return;

        // 轮询定位 select 元素
        const result = await pollLocator(step.locator, {
            maxAttempts: 20,
            intervalMs: 200,
            debug: true,
        });

        if (result.success && result.element) {
            // 如果元素不在视口内，自动滚动到可见位置
            await this.scrollElementIntoViewIfNeeded(result.element);

            this.currentTarget = result.element;

            // 渲染步骤（高亮 select）
            await this.overlay.renderStep(
                step,
                result.element,
                this.currentIndex + 1,
                this.flow.steps.length
            );

            // 监听 select 的 change 事件
            this.selectChangeHandler = (evt: Event) => {
                const target = evt.target as HTMLSelectElement;
                if (target !== result.element) return;

                const selectedOption = target.options[target.selectedIndex];
                const selectedValue = (selectedOption?.textContent || '').trim();
                const expectedValue = step.expectedValue.trim();

                console.log('[Demo Maker] select change:', selectedValue, '期望:', expectedValue);

                // 检查是否选择了期望的值（不区分空格）
                if (selectedValue === expectedValue || selectedValue.includes(expectedValue) || expectedValue.includes(selectedValue)) {
                    // 移除监听器
                    if (this.selectChangeHandler) {
                        document.removeEventListener('change', this.selectChangeHandler, true);
                        this.selectChangeHandler = null;
                    }
                    // 进入下一步
                    setTimeout(() => this.next(), 300);
                }
            };
            document.addEventListener('change', this.selectChangeHandler, true);
        } else {
            // 定位失败
            console.warn('Demo Maker: 无法定位 select 元素', step.locator);
            await this.overlay.renderStep(
                step,
                null,
                this.currentIndex + 1,
                this.flow.steps.length
            );

            if (step.locator.humanDescription) {
                new Notice(`请手动找到: ${step.locator.humanDescription}`);
            }
        }
    }

    /**
     * 处理等待步骤
     */
    private handleWaitStep(step: FlowStep): void {
        if (!this.overlay || !this.flow || step.type !== 'wait') return;

        this.overlay.renderStep(
            step,
            null,
            this.currentIndex + 1,
            this.flow.steps.length
        );

        // 设置定时器
        this.waitTimeout = window.setTimeout(() => {
            this.next();
        }, step.durationMs);
    }

    /**
     * 处理消息步骤
     */
    private async handleMessageStep(step: MessageStep): Promise<void> {
        if (!this.overlay || !this.flow) return;

        let target: HTMLElement | null = null;
        if (step.locator) {
            const result = await pollLocator(step.locator, {
                maxAttempts: 10,
                intervalMs: 200,
            });
            target = result.element;

            // 如果元素不在视口内，自动滚动到可见位置
            if (target) {
                await this.scrollElementIntoViewIfNeeded(target);
            }
        }

        await this.overlay.renderStep(
            step,
            target,
            this.currentIndex + 1,
            this.flow.steps.length
        );
    }

    /**
     * 处理下一步按钮点击
     */
    private handleNext(): void {
        if (!this.flow) return;

        const step = this.flow.steps[this.currentIndex];

        // 只有 input 和 message 类型可以手动触发下一步
        if (step.type === 'input' || step.type === 'message') {
            this.next();
        }
    }

    /**
     * 绑定事件监听
     */
    private bindListeners(): void {
        this.clickHandler = (evt: MouseEvent) => this.handleClick(evt);
        this.keyHandler = (evt: KeyboardEvent) => this.handleKey(evt);

        document.addEventListener('click', this.clickHandler, true);
        document.addEventListener('keydown', this.keyHandler, true);
    }

    /**
     * 解绑事件监听
     */
    private unbindListeners(): void {
        if (this.clickHandler) {
            document.removeEventListener('click', this.clickHandler, true);
            this.clickHandler = null;
        }
        if (this.keyHandler) {
            document.removeEventListener('keydown', this.keyHandler, true);
            this.keyHandler = null;
        }
        if (this.selectChangeHandler) {
            document.removeEventListener('change', this.selectChangeHandler, true);
            this.selectChangeHandler = null;
        }
    }

    /**
     * 处理点击事件
     */
    private handleClick(evt: MouseEvent): void {
        if (this.state !== 'playing' || !this.overlay || !this.flow) return;

        const target = evt.target as HTMLElement;

        // 如果点击的是遮罩层、控制栏、或者是编辑面板内的元素，不进行干扰
        if (target.closest('.demo-maker-overlay') ||
            target.closest('.demo-maker-editor-panel') ||
            target.closest('.demo-maker-control-bar')) {
            return;
        }

        const step = this.flow.steps[this.currentIndex];

        // 只有 click 类型需要检测点击
        if (step.type !== 'click') {
            evt.stopPropagation();
            evt.preventDefault();
            return;
        }

        // 检查是否点击了目标元素
        if (this.currentTarget && this.currentTarget.contains(target)) {
            // 允许点击通过，然后进入下一步
            setTimeout(() => {
                this.next();
            }, 100);
            return;
        }

        // 点击了其他区域，阻止
        evt.stopPropagation();
        evt.preventDefault();
    }

    /**
     * 处理键盘事件
     */
    private handleKey(evt: KeyboardEvent): void {
        if (this.state !== 'playing') return;

        // ESC 退出
        if (evt.key === 'Escape') {
            evt.preventDefault();
            this.stop('已退出引导');
            return;
        }

        // 如果正在输入框中，不处理其他按键
        const target = evt.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
            return;
        }
    }

    /**
     * 如果元素不在视口内，滚动到可见位置
     */
    private async scrollElementIntoViewIfNeeded(element: HTMLElement): Promise<void> {
        const rect = element.getBoundingClientRect();
        const isInViewport = (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= window.innerHeight &&
            rect.right <= window.innerWidth
        );

        if (!isInViewport) {
            // 滚动到元素中心位置
            element.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'center'
            });

            // 等待滚动动画完成（约 300-500ms）
            await new Promise(resolve => setTimeout(resolve, 400));
        }
    }

    /**
     * 清除定时器
     */
    private clearTimers(): void {
        if (this.waitTimeout) {
            window.clearTimeout(this.waitTimeout);
            this.waitTimeout = null;
        }
        if (this.pollTimeout) {
            window.clearTimeout(this.pollTimeout);
            this.pollTimeout = null;
        }
        if (this.selectChangeHandler) {
            document.removeEventListener('change', this.selectChangeHandler, true);
            this.selectChangeHandler = null;
        }
    }

    /**
     * 插件卸载时调用
     */
    onUnload(): void {
        this.stop();
    }
}
