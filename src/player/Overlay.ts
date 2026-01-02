/**
 * Demo Maker - 遮罩层管理
 * 负责显示遮罩、高亮框和提示气泡
 */

import { FlowStep, TextAnnotation, Placement, ClickStep, InputStep, SelectStep } from '../core/types';

/**
 * 遮罩层管理器
 */
export class Overlay {
    private container: HTMLDivElement;
    private backdrop: HTMLDivElement;
    private highlight: HTMLDivElement;
    private tooltip: HTMLDivElement;
    private controlBar: HTMLDivElement;
    private stepInfo: HTMLSpanElement;
    private nextButton: HTMLButtonElement;
    private exitButton: HTMLButtonElement;

    private onExit: () => void;
    private onNext: () => void;

    constructor(options: { onExit: () => void; onNext: () => void }) {
        this.onExit = options.onExit;
        this.onNext = options.onNext;

        // 创建主容器
        this.container = document.createElement('div');
        this.container.className = 'demo-maker-overlay';

        // 创建背景遮罩
        this.backdrop = document.createElement('div');
        this.backdrop.className = 'demo-maker-backdrop';

        // 创建高亮框
        this.highlight = document.createElement('div');
        this.highlight.className = 'demo-maker-highlight';

        // 创建提示气泡
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'demo-maker-tooltip';

        // 创建控制栏
        this.controlBar = document.createElement('div');
        this.controlBar.className = 'demo-maker-control-bar';

        // 退出按钮
        this.exitButton = document.createElement('button');
        this.exitButton.className = 'demo-maker-exit-btn';
        this.exitButton.textContent = '退出引导';
        this.exitButton.onclick = () => this.onExit();

        // 步骤信息
        this.stepInfo = document.createElement('span');
        this.stepInfo.className = 'demo-maker-step-info';

        // 下一步按钮（用于 input/message 类型）
        this.nextButton = document.createElement('button');
        this.nextButton.className = 'demo-maker-next-btn';
        this.nextButton.textContent = '下一步';
        this.nextButton.onclick = () => this.onNext();
        this.nextButton.style.display = 'none';

        // 组装控制栏
        this.controlBar.appendChild(this.exitButton);
        this.controlBar.appendChild(this.stepInfo);
        this.controlBar.appendChild(this.nextButton);

        // 组装容器
        this.container.appendChild(this.backdrop);
        this.container.appendChild(this.highlight);
        this.container.appendChild(this.tooltip);
        this.container.appendChild(this.controlBar);
    }

    /**
     * 显示遮罩层
     */
    show(): void {
        document.body.appendChild(this.container);
    }

    /**
     * 隐藏遮罩层
     */
    hide(): void {
        this.container.remove();
    }

    /**
     * 检查元素是否属于遮罩层
     */
    contains(element: HTMLElement): boolean {
        return this.container.contains(element);
    }

    /**
     * 更新步骤信息
     */
    updateStepInfo(current: number, total: number): void {
        this.stepInfo.textContent = `步骤 ${current}/${total}`;
    }

    /**
     * 显示/隐藏下一步按钮
     */
    setNextButtonVisible(visible: boolean): void {
        this.nextButton.style.display = visible ? 'block' : 'none';
    }

    /**
     * 设置下一步按钮文字
     */
    setNextButtonText(text: string): void {
        this.nextButton.textContent = text;
    }

    /**
     * 高亮目标元素
     */
    highlightElement(target: HTMLElement | null): void {
        if (!target) {
            this.hideHighlight();
            return;
        }

        const rect = target.getBoundingClientRect();
        const padding = 4;

        this.highlight.style.display = 'block';
        this.highlight.style.top = `${rect.top + window.scrollY - padding}px`;
        this.highlight.style.left = `${rect.left + window.scrollX - padding}px`;
        this.highlight.style.width = `${rect.width + padding * 2}px`;
        this.highlight.style.height = `${rect.height + padding * 2}px`;

        // 在遮罩上挖一个洞，让下层元素可交互
        this.updateBackdropHole(rect, padding);
    }

    /**
     * 更新遮罩层的镂空区域
     */
    private updateBackdropHole(rect: DOMRect | null, padding: number = 4): void {
        if (!rect) {
            this.backdrop.style.clipPath = 'none';
            return;
        }

        const top = rect.top - padding;
        const left = rect.left - padding;
        const bottom = rect.bottom + padding;
        const right = rect.right + padding;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        // 使用 polygon 挖洞路径
        // 外圈逆时针 (TopLeft -> BottomLeft -> BottomRight -> TopRight -> TopLeft)
        // 内圈顺时针 (TopLeft -> TopRight -> BottomRight -> BottomLeft -> TopLeft)
        // 这样在 non-zero 规则下能正确形成镂空
        this.backdrop.style.clipPath = `polygon(
            0% 0%, 0% 100%, 100% 100%, 100% 0%, 0% 0%,
            ${left}px ${top}px, 
            ${right}px ${top}px, 
            ${right}px ${bottom}px, 
            ${left}px ${bottom}px, 
            ${left}px ${top}px
        )`;
    }

    /**
     * 设置是否允许交互
     * 现在的实现是：backdrop 始终显示（除非没有目标），但高亮区域是镂空的
     */
    setClickable(clickable: boolean): void {
        // 如果允许点击穿透，我们已经在 highlightElement 中通过 clip-path 实现了
        // 这里主要控制 backdrop 的显示状态，如果没有高亮目标，则全屏遮罩
        this.backdrop.style.display = 'block';
    }

    /**
     * 隐藏高亮框（用于 message 类型）
     */
    hideHighlight(): void {
        this.highlight.style.display = 'none';
        this.updateBackdropHole(null);
    }

    /**
     * 显示提示文字
     */
    showTooltip(content: string, target?: HTMLElement, placement: Placement = 'bottom'): void {
        this.tooltip.textContent = content;
        this.tooltip.style.display = 'block';
        this.tooltip.dataset.placement = placement;

        if (target) {
            // 相对于目标元素定位
            const rect = target.getBoundingClientRect();
            this.positionTooltip(rect, placement);
        } else {
            // 屏幕居中
            this.tooltip.style.position = 'fixed';
            this.tooltip.style.top = '50%';
            this.tooltip.style.left = '50%';
            this.tooltip.style.transform = 'translate(-50%, -50%)';
        }
    }

    /**
     * 隐藏提示
     */
    hideTooltip(): void {
        this.tooltip.style.display = 'none';
    }

    /**
     * 定位提示气泡
     */
    private positionTooltip(rect: DOMRect, placement: Placement): void {
        const gap = 12;
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // 先重置 transform
        this.tooltip.style.transform = '';
        this.tooltip.style.position = 'absolute';

        switch (placement) {
            case 'top':
                this.tooltip.style.left = `${centerX + window.scrollX}px`;
                this.tooltip.style.top = `${rect.top + window.scrollY - gap}px`;
                this.tooltip.style.transform = 'translate(-50%, -100%)';
                break;
            case 'bottom':
                this.tooltip.style.left = `${centerX + window.scrollX}px`;
                this.tooltip.style.top = `${rect.bottom + window.scrollY + gap}px`;
                this.tooltip.style.transform = 'translate(-50%, 0)';
                break;
            case 'left':
                this.tooltip.style.left = `${rect.left + window.scrollX - gap}px`;
                this.tooltip.style.top = `${centerY + window.scrollY}px`;
                this.tooltip.style.transform = 'translate(-100%, -50%)';
                break;
            case 'right':
                this.tooltip.style.left = `${rect.right + window.scrollX + gap}px`;
                this.tooltip.style.top = `${centerY + window.scrollY}px`;
                this.tooltip.style.transform = 'translate(0, -50%)';
                break;
            case 'center':
            default:
                this.tooltip.style.position = 'fixed';
                this.tooltip.style.top = '50%';
                this.tooltip.style.left = '50%';
                this.tooltip.style.transform = 'translate(-50%, -50%)';
                break;
        }
    }

    /**
     * 渲染步骤
     */
    renderStep(step: FlowStep, target: HTMLElement | null, current: number, total: number, hint?: string): void {
        this.updateStepInfo(current, total);

        // 根据步骤类型渲染
        switch (step.type) {
            case 'click':
                this.renderClickStep(step, target);
                break;
            case 'input':
                this.renderInputStep(step, target);
                break;
            case 'select':
                this.renderSelectStep(step, target, hint);
                break;
            case 'message':
                this.renderMessageStep(step, target);
                break;
            case 'wait':
                this.renderWaitStep(step);
                break;
        }
    }

    /**
     * 渲染点击步骤
     */
    private renderClickStep(step: ClickStep, target: HTMLElement | null): void {
        this.setClickable(true);  // 允许点击穿透到目标元素
        this.setNextButtonVisible(false);

        if (target) {
            this.highlightElement(target);
            // 获取提示文字
            const tipText = this.getStepTooltipText(step);
            if (tipText) {
                const placement = this.getTooltipPlacement(step);
                this.showTooltip(tipText, target, placement);
            } else {
                this.hideTooltip();
            }
        } else {
            this.hideHighlight();
            this.showTooltip('无法定位目标元素');
        }
    }

    /**
     * 渲染输入步骤
     */
    private renderInputStep(step: InputStep, target: HTMLElement | null): void {
        this.setClickable(true);  // 允许点击穿透到输入元素
        this.setNextButtonVisible(true);
        this.setNextButtonText('下一步');

        if (target) {
            this.highlightElement(target);
            const tipText = this.getStepTooltipText(step);
            if (tipText) {
                const placement = this.getTooltipPlacement(step);
                this.showTooltip(tipText, target, placement);
            } else {
                this.hideTooltip();
            }
        } else {
            this.hideHighlight();
            this.showTooltip('无法定位目标元素');
        }
    }

    /**
     * 渲染选择步骤（下拉选单）
     */
    private renderSelectStep(step: SelectStep, target: HTMLElement | null, hint?: string): void {
        this.setClickable(true);  // 允许点击穿透到 select 元素
        this.setNextButtonVisible(true); // 显示下一步按钮作为手动兜底
        this.setNextButtonText('下一步');

        if (target) {
            this.highlightElement(target);
            const tipText = hint || `请选择：${step.expectedValue}`;
            const placement = this.getTooltipPlacement(step);
            this.showTooltip(tipText, target, placement);
        } else {
            this.hideHighlight();
            this.showTooltip('无法定位目标选择框');
        }
    }

    /**
     * 渲染消息步骤
     */
    private renderMessageStep(step: FlowStep, target: HTMLElement | null): void {
        this.setClickable(false);  // 默认阻止点击，需要点"继续"按钮
        this.setNextButtonVisible(true);
        this.setNextButtonText('继续');

        if (target) {
            this.highlightElement(target);
            const tipText = this.getStepTooltipText(step);
            if (tipText) {
                const placement = this.getTooltipPlacement(step);
                this.showTooltip(tipText, target, placement);
            }
        } else {
            this.hideHighlight();
            const tipText = this.getStepTooltipText(step);
            if (tipText) {
                this.showTooltip(tipText);
            }
        }
    }

    /**
     * 渲染等待步骤
     */
    private renderWaitStep(step: FlowStep): void {
        this.setClickable(false);  // 等待时阻止点击
        this.hideHighlight();
        this.setNextButtonVisible(false);

        if (step.type === 'wait') {
            const seconds = Math.ceil(step.durationMs / 1000);
            this.showTooltip(`等待 ${seconds} 秒...`);
        }
    }

    /**
     * 获取步骤的提示文字
     */
    private getStepTooltipText(step: FlowStep): string | null {
        if (!step.annotations || step.annotations.length === 0) {
            return null;
        }

        // 返回第一个文字标注的内容
        const textAnnotation = step.annotations.find(a => a.type === 'text') as TextAnnotation | undefined;
        return textAnnotation?.content || null;
    }

    /**
     * 获取提示位置
     */
    private getTooltipPlacement(step: FlowStep): Placement {
        if (!step.annotations || step.annotations.length === 0) {
            return 'bottom';
        }

        const textAnnotation = step.annotations.find(a => a.type === 'text') as TextAnnotation | undefined;
        return textAnnotation?.position?.placement || 'bottom';
    }

    /**
     * 获取高亮框元素（用于点击检测）
     */
    getHighlightElement(): HTMLDivElement {
        return this.highlight;
    }
}
