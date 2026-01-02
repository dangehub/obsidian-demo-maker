/**
 * Demo Maker - 遮罩层管理
 * 负责显示遮罩、高亮框和提示气泡
 */

import { FlowStep, TextAnnotation, ArrowAnnotation, Placement, ClickStep, InputStep, SelectStep } from '../core/types';

/**
 * 遮罩层管理器
 */
export class Overlay {
    private container: HTMLDivElement;
    private backdrop: HTMLDivElement;
    private highlight: HTMLDivElement;
    private tooltip: HTMLDivElement;
    private svgLayer: SVGSVGElement;
    private controlBar: HTMLDivElement;
    private stepInfo: HTMLSpanElement;
    private nextButton: HTMLButtonElement;
    private editButton: HTMLButtonElement;
    private exitButton: HTMLButtonElement;

    private onExit: () => void;
    private onNext: () => void;
    private onEdit: () => void;
    private onAnnotationChange?: (anno: ArrowAnnotation) => void;

    private isEditingMode = false;
    private activeDrag: { anno: ArrowAnnotation; point: 'from' | 'to'; element: HTMLElement | null } | null = null;

    constructor(options: {
        onExit: () => void;
        onNext: () => void;
        onEdit: () => void;
        onAnnotationChange?: (anno: ArrowAnnotation) => void;
    }) {
        this.onExit = options.onExit;
        this.onNext = options.onNext;
        this.onEdit = options.onEdit;
        this.onAnnotationChange = options.onAnnotationChange;

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

        // 创建 SVG 绘图层
        this.svgLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.svgLayer.setAttribute('class', 'demo-maker-svg-layer');

        // 添加箭头定义
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        marker.setAttribute('id', 'demo-maker-arrowhead');
        marker.setAttribute('markerWidth', '10');
        marker.setAttribute('markerHeight', '7');
        marker.setAttribute('refX', '9');
        marker.setAttribute('refY', '3.5');
        marker.setAttribute('orient', 'auto');

        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        polygon.setAttribute('points', '0 0, 10 3.5, 0 7');
        polygon.setAttribute('fill', '#3b82f6');

        marker.appendChild(polygon);
        defs.appendChild(marker);
        this.svgLayer.appendChild(defs);

        // 创建控制栏
        this.controlBar = document.createElement('div');
        this.controlBar.className = 'demo-maker-control-bar';

        // 退出按钮
        this.exitButton = document.createElement('button');
        this.exitButton.className = 'demo-maker-exit-btn';
        this.exitButton.textContent = '退出引导';
        this.exitButton.onclick = () => this.onExit();

        // 编辑按钮
        this.editButton = document.createElement('button');
        this.editButton.className = 'demo-maker-edit-btn';
        this.editButton.textContent = '编辑此步';
        this.editButton.onclick = () => this.onEdit();

        // 步骤信息
        this.stepInfo = document.createElement('span');
        this.stepInfo.className = 'demo-maker-step-info';

        // 下一步按钮（用于 input/message 类型）
        this.nextButton = document.createElement('button');
        this.nextButton.className = 'demo-maker-next-btn';

        // 组装控制栏
        this.controlBar.appendChild(this.exitButton);
        this.controlBar.appendChild(this.editButton);
        this.controlBar.appendChild(this.stepInfo);
        this.controlBar.appendChild(this.nextButton);
        this.nextButton.textContent = '下一步';
        this.nextButton.onclick = () => this.onNext();
        this.nextButton.style.display = 'none';

        // 组装容器
        this.container.appendChild(this.backdrop);
        this.container.appendChild(this.highlight);
        this.container.appendChild(this.svgLayer);
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
    renderStep(step: FlowStep, target: HTMLElement | null, current: number, total: number): void {
        this.updateStepInfo(current, total);

        // 清理 SVG 层
        this.clearSvgLayer();

        // 渲染基础高亮和提示
        switch (step.type) {
            case 'click':
                this.renderClickStep(step, target);
                break;
            case 'input':
                this.renderInputStep(step, target);
                break;
            case 'select':
                this.renderSelectStep(step, target);
                break;
            case 'message':
                this.renderMessageStep(step, target);
                break;
            case 'wait':
                this.renderWaitStep(step);
                break;
        }

        // 渲染所有额外标注 (如箭头)
        if (step.annotations) {
            step.annotations.forEach(anno => {
                if (anno.type === 'arrow') {
                    this.renderArrow(anno, target);
                }
            });
        }
    }

    setEditingMode(editing: boolean): void {
        this.isEditingMode = editing;
    }

    private clearSvgLayer(): void {
        // 保留 defs，移除其它元素
        const defs = this.svgLayer.querySelector('defs');
        while (this.svgLayer.lastChild && this.svgLayer.lastChild !== defs) {
            this.svgLayer.removeChild(this.svgLayer.lastChild);
        }
    }

    private renderArrow(anno: ArrowAnnotation, target: HTMLElement | null): void {
        const from = this.calculatePoint(anno.from, target);
        const to = this.calculatePoint(anno.to, target);

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', `${from.x}`);
        line.setAttribute('y1', `${from.y}`);
        line.setAttribute('x2', `${to.x}`);
        line.setAttribute('y2', `${to.y}`);
        line.setAttribute('stroke', anno.style?.color || '#3b82f6');
        line.setAttribute('stroke-width', '2');
        line.setAttribute('marker-end', 'url(#demo-maker-arrowhead)');

        this.svgLayer.appendChild(line);

        // 如果处于编辑模式，渲染拖拽手柄
        if (this.isEditingMode) {
            this.renderArrowHandle(from, anno, 'from', target);
            this.renderArrowHandle(to, anno, 'to', target);
        }
    }

    private renderArrowHandle(pos: { x: number; y: number }, anno: ArrowAnnotation, point: 'from' | 'to', target: HTMLElement | null): void {
        const handle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        handle.setAttribute('cx', `${pos.x}`);
        handle.setAttribute('cy', `${pos.y}`);
        handle.setAttribute('r', '6');
        handle.setAttribute('class', 'demo-maker-arrow-handle');

        handle.onmousedown = (e: MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
            this.startDragging(e, anno, point, target);
        };

        this.svgLayer.appendChild(handle);
    }

    private startDragging(e: MouseEvent, anno: ArrowAnnotation, point: 'from' | 'to', target: HTMLElement | null): void {
        this.activeDrag = { anno, point, element: target };

        const onMouseMove = (moveEvent: MouseEvent) => {
            if (!this.activeDrag) return;

            const newPos = this.getRelativePoint(moveEvent.clientX, moveEvent.clientY, this.activeDrag.anno[this.activeDrag.point].anchor, this.activeDrag.element);
            this.activeDrag.anno[this.activeDrag.point].x = newPos.x;
            this.activeDrag.anno[this.activeDrag.point].y = newPos.y;

            // 实时同步数据到编辑器
            this.onAnnotationChange?.(this.activeDrag.anno);

            // 重新绘制，为了性能这里可以只更新当前 Line 和 Handle，但为了简单我们重绘所有
            this.clearSvgLayer();
            // 注意：这里由于我们没有保存当前 step，所以单独调用 renderArrow 可能不方便
            // 我们直接手动重画当前 Arrow
            this.renderArrow(this.activeDrag.anno, this.activeDrag.element);
        };

        const onMouseUp = () => {
            this.activeDrag = null;
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    }

    private getRelativePoint(clientX: number, clientY: number, anchor: 'screen' | 'target', target: HTMLElement | null): { x: number; y: number } {
        if (anchor === 'target' && target) {
            const rect = target.getBoundingClientRect();
            return {
                x: ((clientX - rect.left) / rect.width) * 100,
                y: ((clientY - rect.top) / rect.height) * 100
            };
        }
        // 屏幕坐标使用百分比 (0-1)
        return {
            x: clientX / window.innerWidth,
            y: clientY / window.innerHeight
        };
    }

    private calculatePoint(config: { x: number; y: number; anchor: 'screen' | 'target' }, target: HTMLElement | null): { x: number; y: number } {
        if (config.anchor === 'target' && target) {
            const rect = target.getBoundingClientRect();
            return {
                x: rect.left + rect.width * (config.x / 100),
                y: rect.top + rect.height * (config.y / 100)
            };
        }
        // 默认为屏幕坐标 (百分比或像素)
        return {
            x: config.x > 1 ? config.x : window.innerWidth * config.x,
            y: config.y > 1 ? config.y : window.innerHeight * config.y
        };
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
