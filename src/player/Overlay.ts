/**
 * Demo Maker - 遮罩层管理
 * 负责显示遮罩、高亮框和提示气泡
 */

import { Notice, Plugin, MarkdownRenderer, App } from 'obsidian';
import { FlowDefinition, FlowStep, ClickStep, InputStep, SelectStep, MessageStep, ArrowAnnotation, TextAnnotation, Placement, Annotation } from '../core/types';

/**
 * 遮罩层管理器
 */
export class Overlay {
    private plugin: Plugin;
    private container: HTMLDivElement;
    private backdrop: HTMLDivElement;
    private highlight: HTMLDivElement;
    private tooltipContainer: HTMLDivElement; // 新容器，用于放置多个文字批注
    private svgLayer: SVGSVGElement;
    private controlBar: HTMLDivElement;
    private stepInfo: HTMLSpanElement;
    private nextButton: HTMLButtonElement;
    private editButton: HTMLButtonElement;
    private exitButton: HTMLButtonElement;

    private onExit: () => void;
    private onNext: () => void;
    private onEdit: () => void;
    private onAnnotationChange?: (anno: Annotation) => void;
    private onDeleteAnnotation?: (id: string) => void;
    private onAnnotationContentChange?: (id: string, content: string) => void;

    private isEditingMode = false;
    private activeDrag: { anno: ArrowAnnotation; point: 'from' | 'to'; element: HTMLElement | null } | null = null;
    private currentTarget: HTMLElement | null = null;
    private currentAnnotations: Annotation[] = []; // 存储当前步骤的所有批注

    constructor(plugin: Plugin, options: {
        onExit: () => void;
        onNext: () => void;
        onEdit: () => void;
        onAnnotationChange?: (anno: Annotation) => void;
        onDeleteAnnotation?: (id: string) => void;
        onAnnotationContentChange?: (id: string, content: string) => void;
    }) {
        this.plugin = plugin;
        this.onExit = options.onExit;
        this.onNext = options.onNext;
        this.onEdit = options.onEdit;
        this.onAnnotationChange = options.onAnnotationChange;
        this.onDeleteAnnotation = options.onDeleteAnnotation;
        this.onAnnotationContentChange = options.onAnnotationContentChange;

        // 创建主容器
        this.container = document.createElement('div');
        this.container.className = 'demo-maker-overlay';

        // 创建背景遮罩
        this.backdrop = document.createElement('div');
        this.backdrop.className = 'demo-maker-backdrop';

        // 创建高亮框
        this.highlight = document.createElement('div');
        this.highlight.className = 'demo-maker-highlight';

        // 创建文字批注容器（用于放置多个文字批注）
        this.tooltipContainer = document.createElement('div');
        this.tooltipContainer.className = 'demo-maker-tooltip-container';

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
        this.container.appendChild(this.tooltipContainer);
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
     * 设置拾取模式
     * 拾取模式下，隐藏遮罩层的所有可见元素，让用户可以自由选择界面元素
     */
    setPickingMode(active: boolean): void {
        if (active) {
            this.backdrop.style.display = 'none';
            this.highlight.style.display = 'none';
            this.tooltipContainer.style.display = 'none';
            this.controlBar.style.display = 'none';
        } else {
            this.backdrop.style.display = 'block';
            this.controlBar.style.display = 'flex';
            this.tooltipContainer.style.display = 'block';
            // highlight 会在 renderStep 中恢复
        }
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

        console.log('[Demo Maker] highlightElement rect:', {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            windowScrollY: window.scrollY,
            windowScrollX: window.scrollX
        });

        // 使用视口坐标直接定位（overlay 是 position:fixed）
        // 不使用 window.scrollY/X 因为 Obsidian 使用内部容器滚动
        this.highlight.style.display = 'block';
        this.highlight.style.top = `${rect.top - padding}px`;
        this.highlight.style.left = `${rect.left - padding}px`;
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
     * 渲染所有文字批注
     */
    async renderAllTextAnnotations(annotations: TextAnnotation[], target?: HTMLElement): Promise<void> {
        // 清空旧内容
        this.tooltipContainer.innerHTML = '';
        this.currentTarget = target || null;

        for (const anno of annotations) {
            await this.renderSingleTextAnnotation(anno, target);
        }
    }

    /**
     * 渲染单个文字批注
     */
    private async renderSingleTextAnnotation(anno: TextAnnotation, target?: HTMLElement): Promise<void> {
        // 防止重复：如果已存在相同 ID 的批注，先移除
        const existing = this.tooltipContainer.querySelector(`[data-annotation-id="${anno.id}"]`);
        if (existing) existing.remove();

        const tooltip = document.createElement('div');
        tooltip.className = `demo-maker-tooltip theme-${anno.style?.theme || 'default'}`;
        tooltip.dataset.annotationId = anno.id;
        tooltip.dataset.placement = anno.position.placement;
        tooltip.style.display = 'block';
        tooltip.style.visibility = 'hidden';
        tooltip.style.top = '-9999px';

        // 内容容器
        const contentEl = document.createElement('div');
        contentEl.className = 'demo-maker-tooltip-content';

        // 渲染 Markdown
        // @ts-ignore
        await MarkdownRenderer.render(this.plugin.app, anno.content, contentEl, '', this.plugin);

        tooltip.appendChild(contentEl);

        // 编辑模式下添加按钮
        if (this.isEditingMode) {
            tooltip.classList.add('is-editing');
            const toolbar = this.createAnnotationToolbar(anno, tooltip, contentEl);
            tooltip.appendChild(toolbar);

            // 拖拽支持
            tooltip.onmousedown = (e: MouseEvent) => {
                if ((e.target as HTMLElement).closest('.demo-maker-anno-toolbar')) return;
                if (e.button !== 0) return;
                e.stopPropagation();
                e.preventDefault();
                this.startTextDragging(e, anno, tooltip, target);
            };
        }

        this.tooltipContainer.appendChild(tooltip);

        // 等待布局
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

        // 定位
        this.positionTooltipElement(tooltip, anno, target);

        // 显示
        tooltip.style.visibility = 'visible';
    }

    /**
     * 创建批注工具栏（编辑/删除按钮）
     */
    private createAnnotationToolbar(anno: TextAnnotation, tooltip: HTMLDivElement, contentEl: HTMLElement): HTMLDivElement {
        const toolbar = document.createElement('div');
        toolbar.className = 'demo-maker-anno-toolbar';

        // 编辑按钮
        const editBtn = document.createElement('button');
        editBtn.className = 'demo-maker-anno-btn';
        editBtn.textContent = '✏️';
        editBtn.title = '编辑';
        editBtn.onclick = (e) => {
            e.stopPropagation();
            this.showInlineEditor(anno, tooltip, contentEl);
        };

        // 删除按钮
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'demo-maker-anno-btn demo-maker-anno-btn-danger';
        deleteBtn.textContent = '🗑';
        deleteBtn.title = '删除';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            tooltip.remove();
            this.onDeleteAnnotation?.(anno.id);
        };

        toolbar.appendChild(editBtn);
        toolbar.appendChild(deleteBtn);
        return toolbar;
    }

    /**
     * 显示内联编辑器
     */
    private showInlineEditor(anno: TextAnnotation, tooltip: HTMLDivElement, contentEl: HTMLElement): void {
        contentEl.innerHTML = '';
        const input = document.createElement('textarea');
        input.className = 'demo-maker-inline-editor';
        input.value = anno.content;
        input.onkeydown = (e) => {
            if (e.key === 'Escape') {
                // 取消编辑，恢复显示 - 通知回调触发重渲染
                this.onAnnotationContentChange?.(anno.id, anno.content);
            }
        };

        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'demo-maker-inline-confirm';
        confirmBtn.textContent = '✓';
        confirmBtn.onclick = () => {
            const newContent = input.value;
            // 只调用回调，它会触发 onPreview 进行完整重渲染
            // 不再调用 refreshSingleAnnotation，避免双重创建
            this.onAnnotationContentChange?.(anno.id, newContent);
        };

        contentEl.appendChild(input);
        contentEl.appendChild(confirmBtn);
        input.focus();
    }

    /**
     * 刷新单个批注的显示
     */
    private async refreshSingleAnnotation(anno: TextAnnotation): Promise<void> {
        const existing = this.tooltipContainer.querySelector(`[data-annotation-id="${anno.id}"]`);
        if (existing) existing.remove();
        await this.renderSingleTextAnnotation(anno, this.currentTarget || undefined);
    }

    private startTextDragging(e: MouseEvent, anno: TextAnnotation, tooltip: HTMLDivElement, target?: HTMLElement): void {
        const startX = e.clientX;
        const startY = e.clientY;
        const startOffsetX = anno.position.offsetX || 0;
        const startOffsetY = anno.position.offsetY || 0;

        tooltip.classList.add('is-dragging');

        const onMouseMove = (moveEvent: MouseEvent) => {
            // 确保 tooltip 仍在 DOM 中
            if (!this.tooltipContainer.contains(tooltip)) return;

            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;

            anno.position.offsetX = startOffsetX + dx;
            anno.position.offsetY = startOffsetY + dy;

            this.positionTooltipElement(tooltip, anno, target);
            // 只在拖拽结束时同步数据，减少回调频率
        };

        const onMouseUp = () => {
            tooltip.classList.remove('is-dragging');
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            // 拖拽结束后同步数据
            this.onAnnotationChange?.(anno);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    }

    /**
     * 隐藏所有文字批注
     */
    hideTooltip(): void {
        this.tooltipContainer.innerHTML = '';
    }

    /**
     * 定位单个批注元素
     */
    private positionTooltipElement(tooltip: HTMLDivElement, anno: TextAnnotation, target?: HTMLElement): void {
        const gap = 12;
        const placement = anno.position.placement;
        const offsetX = anno.position.offsetX || 0;
        const offsetY = anno.position.offsetY || 0;

        let rect: DOMRect;
        if (target) {
            rect = target.getBoundingClientRect();
        } else {
            const vh = window.innerHeight;
            const vw = window.innerWidth;
            rect = { top: vh / 2, left: vw / 2, bottom: vh / 2, right: vw / 2, width: 0, height: 0, x: vw / 2, y: vh / 2 } as DOMRect;
        }

        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const tw = tooltip.offsetWidth;
        const th = tooltip.offsetHeight;

        let top = 0, left = 0;

        switch (placement) {
            case 'top': top = rect.top - th - gap; left = centerX - tw / 2; break;
            case 'bottom': top = rect.bottom + gap; left = centerX - tw / 2; break;
            case 'left': top = centerY - th / 2; left = rect.left - tw - gap; break;
            case 'right': top = centerY - th / 2; left = rect.right + gap; break;
            case 'center': top = centerY - th / 2; left = centerX - tw / 2; break;
        }

        // 边界修正
        const padding = 10;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        if (left < padding) left = padding;
        if (left + tw > vw - padding) left = vw - tw - padding;
        if (top < padding) top = padding;
        if (top + th > vh - padding) top = vh - th - padding;

        tooltip.style.top = `${top + offsetY}px`;
        tooltip.style.left = `${left + offsetX}px`;
    }

    /**
     * 渲染步骤
     */
    async renderStep(step: FlowStep, target: HTMLElement | null, current: number, total: number): Promise<void> {
        this.updateStepInfo(current, total);

        // 存储当前批注和目标，供拖拽时重绘使用
        this.currentAnnotations = step.annotations || [];
        this.currentTarget = target;

        // 清理 SVG 层和文字批注
        this.clearSvgLayer();
        this.hideTooltip();

        // 渲染基础高亮和提示
        switch (step.type) {
            case 'click':
                await this.renderClickStep(step, target);
                break;
            case 'input':
                await this.renderInputStep(step, target);
                break;
            case 'select':
                await this.renderSelectStep(step, target);
                break;
            case 'message':
                await this.renderMessageStep(step, target);
                break;
            case 'wait':
                await this.renderWaitStep(step);
                break;
        }

        // 渲染所有额外标注 (如箭头) - 在文字批注完成后
        this.renderAllArrows();
    }

    /**
     * 渲染所有箭头批注
     */
    private renderAllArrows(): void {
        this.currentAnnotations.forEach(anno => {
            if (anno.type === 'arrow') {
                this.renderArrow(anno, this.currentTarget);
            }
        });
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

        // 如果处于编辑模式，渲染拖拽手柄和删除按钮
        if (this.isEditingMode) {
            this.renderArrowHandle(from, anno, 'from', target);
            this.renderArrowHandle(to, anno, 'to', target);
            this.renderArrowDeleteButton(from, to, anno);
        }
    }

    /**
     * 渲染箭头删除按钮
     */
    private renderArrowDeleteButton(from: { x: number; y: number }, to: { x: number; y: number }, anno: ArrowAnnotation): void {
        // 删除按钮放在箭头中点
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;

        const deleteBtn = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        deleteBtn.setAttribute('class', 'demo-maker-arrow-delete');
        deleteBtn.style.cursor = 'pointer';

        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        bg.setAttribute('cx', `${midX}`);
        bg.setAttribute('cy', `${midY}`);
        bg.setAttribute('r', '10');
        bg.setAttribute('fill', '#ef4444');

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', `${midX}`);
        text.setAttribute('y', `${midY + 4}`);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', 'white');
        text.setAttribute('font-size', '12');
        text.textContent = '×';

        deleteBtn.appendChild(bg);
        deleteBtn.appendChild(text);

        deleteBtn.onmousedown = (e: MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
            this.onDeleteAnnotation?.(anno.id);
            // 清理 SVG 层中的该箭头
            this.clearSvgLayer();
        };

        this.svgLayer.appendChild(deleteBtn);
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

            // 重新绘制所有箭头
            this.clearSvgLayer();
            this.renderAllArrows();
        };

        const onMouseUp = () => {
            // 拖拽结束后同步数据到编辑器
            if (this.activeDrag) {
                this.onAnnotationChange?.(this.activeDrag.anno);
            }
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

    private createTemporaryAnnotation(content: string, placement: Placement = 'bottom', anchor: 'target' | 'screen' = 'target'): TextAnnotation {
        return {
            id: 'temp-' + Date.now(),
            type: 'text',
            content,
            position: { anchor, placement, offsetX: 0, offsetY: 0 }
        };
    }

    /**
     * 渲染点击步骤
     */
    private async renderClickStep(step: ClickStep, target: HTMLElement | null): Promise<void> {
        this.setClickable(true);
        this.setNextButtonVisible(false);

        if (target) {
            this.highlightElement(target);
            const textAnnos = (step.annotations?.filter(a => a.type === 'text') || []) as TextAnnotation[];
            await this.renderAllTextAnnotations(textAnnos, target);
        } else {
            this.hideHighlight();
            await this.renderAllTextAnnotations([this.createTemporaryAnnotation('无法定位目标元素', 'center', 'screen')]);
        }
    }

    /**
     * 渲染输入步骤
     */
    private async renderInputStep(step: InputStep, target: HTMLElement | null): Promise<void> {
        this.setClickable(true);
        this.setNextButtonVisible(true);
        this.setNextButtonText('下一步');

        if (target) {
            this.highlightElement(target);
            const textAnnos = (step.annotations?.filter(a => a.type === 'text') || []) as TextAnnotation[];
            await this.renderAllTextAnnotations(textAnnos, target);
        } else {
            this.hideHighlight();
            await this.renderAllTextAnnotations([this.createTemporaryAnnotation('无法定位目标元素', 'center', 'screen')]);
        }
    }

    /**
     * 渲染选择步骤
     */
    private async renderSelectStep(step: SelectStep, target: HTMLElement | null, hint?: string): Promise<void> {
        this.setClickable(true);
        this.setNextButtonVisible(true);
        this.setNextButtonText('下一步');

        if (target) {
            this.highlightElement(target);
            const textAnnos = (step.annotations?.filter(a => a.type === 'text') || []) as TextAnnotation[];
            if (textAnnos.length > 0) {
                await this.renderAllTextAnnotations(textAnnos, target);
            } else {
                await this.renderAllTextAnnotations([this.createTemporaryAnnotation(hint || `请选择：${step.expectedValue}`)], target);
            }
        } else {
            this.hideHighlight();
            await this.renderAllTextAnnotations([this.createTemporaryAnnotation('无法定位目标选择框', 'center', 'screen')]);
        }
    }

    /**
     * 渲染消息步骤
     */
    private async renderMessageStep(step: MessageStep, target: HTMLElement | null): Promise<void> {
        this.setClickable(false);
        this.setNextButtonVisible(true);
        this.setNextButtonText('继续');

        const textAnnos = (step.annotations?.filter(a => a.type === 'text') || []) as TextAnnotation[];
        if (target) {
            this.highlightElement(target);
            await this.renderAllTextAnnotations(textAnnos, target);
        } else {
            this.hideHighlight();
            await this.renderAllTextAnnotations(textAnnos);
        }
    }

    /**
     * 渲染等待步骤
     */
    private async renderWaitStep(step: FlowStep): Promise<void> {
        this.setClickable(false);
        this.hideHighlight();
        this.setNextButtonVisible(false);

        if (step.type === 'wait') {
            const seconds = Math.ceil(step.durationMs / 1000);
            await this.renderAllTextAnnotations([this.createTemporaryAnnotation(`等待 ${seconds} 秒...`, 'center', 'screen')]);
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
