/**
 * Demo Maker - 编辑面板
 * 播放过程中用于修改步骤的悬浮面板
 */

import { FlowStep, ClickStep, InputStep, SelectStep, TextAnnotation, ArrowAnnotation } from '../core/types';

export interface EditorPanelCallbacks {
    onSave: (step: FlowStep) => void;
    onCancel: () => void;
    onRePickElement: () => void;
    onPreview: (step: FlowStep) => void;
}

/**
 * 编辑控制面板
 */
export class EditorPanel {
    private container: HTMLDivElement;
    private callbacks: EditorPanelCallbacks;
    private currentStep: FlowStep;

    // UI 元素
    private typeInfoEl: HTMLDivElement;
    private locatorInfoEl: HTMLDivElement;
    private hintInput: HTMLTextAreaElement;
    private placementSelect: HTMLSelectElement;
    private expectedInput?: HTMLInputElement;
    private arrowInputs: { fx: HTMLInputElement, fy: HTMLInputElement, tx: HTMLInputElement, ty: HTMLInputElement } | null = null;

    // 拖拽状态
    private isDragging = false;
    private dragOffset = { x: 0, y: 0 };

    constructor(step: FlowStep, callbacks: EditorPanelCallbacks) {
        this.currentStep = JSON.parse(JSON.stringify(step)); // 深拷贝以便撤销
        this.callbacks = callbacks;

        this.initUI();
    }

    private initUI(): void {
        // 创建容器
        this.container = document.createElement('div');
        this.container.className = 'demo-maker-editor-panel';

        // 标题栏
        const header = document.createElement('div');
        header.className = 'demo-maker-editor-header';
        header.innerHTML = `<span>✏️ 编辑步骤 </span>`;

        // 内容区域
        const content = document.createElement('div');
        content.className = 'demo-maker-editor-content';

        // 步骤类型信息
        this.typeInfoEl = document.createElement('div');
        this.typeInfoEl.className = 'demo-maker-editor-field';
        this.updateTypeInfo();

        // 定位器信息与重选按钮
        const locatorGroup = document.createElement('div');
        locatorGroup.className = 'demo-maker-editor-field';

        const locatorLabel = document.createElement('label');
        locatorLabel.textContent = '目标元素:';

        this.locatorInfoEl = document.createElement('div');
        this.locatorInfoEl.className = 'demo-maker-editor-locator-preview';
        this.updateLocatorInfo();

        const rePickBtn = document.createElement('button');
        rePickBtn.textContent = '重新选择目标';
        rePickBtn.className = 'demo-maker-repick-btn';
        rePickBtn.onclick = () => this.callbacks.onRePickElement();

        locatorGroup.appendChild(locatorLabel);
        locatorGroup.appendChild(this.locatorInfoEl);
        locatorGroup.appendChild(rePickBtn);

        // 提示文字编辑
        const hintGroup = document.createElement('div');
        hintGroup.className = 'demo-maker-editor-field';

        const hintLabel = document.createElement('label');
        hintLabel.textContent = '提示文字 (Markdown):';

        this.hintInput = document.createElement('textarea');
        this.hintInput.className = 'demo-maker-editor-textarea';
        this.hintInput.value = this.getStepHint();
        this.hintInput.oninput = () => {
            this.updateStepHint(this.hintInput.value);
            this.callbacks.onPreview(this.currentStep);
        };

        // 位置选择器
        const placementGroup = document.createElement('div');
        placementGroup.className = 'demo-maker-editor-field';
        const placementLabel = document.createElement('label');
        placementLabel.textContent = '标注位置:';

        this.placementSelect = document.createElement('select');
        this.placementSelect.className = 'demo-maker-editor-select';
        ['top', 'bottom', 'left', 'right', 'center'].forEach(p => {
            const opt = document.createElement('option');
            opt.value = p;
            opt.textContent = p.toUpperCase();
            this.placementSelect.appendChild(opt);
        });
        this.placementSelect.value = this.getStepPlacement();
        this.placementSelect.onchange = () => {
            this.updateStepPlacement(this.placementSelect.value as any);
            this.callbacks.onPreview(this.currentStep);
        };

        hintGroup.appendChild(hintLabel);
        hintGroup.appendChild(this.hintInput);
        placementGroup.appendChild(placementLabel);
        placementGroup.appendChild(this.placementSelect);

        // 组装内容
        content.appendChild(this.typeInfoEl);
        content.appendChild(locatorGroup);

        // 针对特殊类型的额外字段 (如 Select 的期望值)
        this.addTypeSpecificFields(content);

        // 标注列表管理 (目前仅支持 1 个文字，准备支持箭头)
        content.appendChild(hintGroup);
        content.appendChild(placementGroup);

        // 箭头编辑区域
        this.addArrowEditingUI(content);
        // 底部按钮
        const footer = document.createElement('div');
        footer.className = 'demo-maker-editor-footer';

        const saveBtn = document.createElement('button');
        saveBtn.className = 'demo-maker-editor-save';
        saveBtn.textContent = '应用修改';
        saveBtn.onclick = () => this.callbacks.onSave(this.currentStep);

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'demo-maker-editor-cancel';
        cancelBtn.textContent = '取消';
        cancelBtn.onclick = () => this.callbacks.onCancel();

        footer.appendChild(saveBtn);
        footer.appendChild(cancelBtn);

        // 整体组装
        this.container.appendChild(header);
        this.container.appendChild(content);
        this.container.appendChild(footer);

        // 拖拽
        header.onmousedown = (e) => this.startDrag(e);
        document.addEventListener('mousemove', (e) => this.onDrag(e));
        document.addEventListener('mouseup', () => this.endDrag());
    }

    private updateTypeInfo(): void {
        const typeMap: any = {
            'click': '点击步骤',
            'input': '输入步骤',
            'select': '选择步骤',
            'message': '提示步骤',
            'wait': '等待步骤'
        };
        this.typeInfoEl.innerHTML = `<strong>类型:</strong> ${typeMap[this.currentStep.type] || this.currentStep.type}`;
    }

    private updateLocatorInfo(): void {
        const step = this.currentStep as any;
        if (!step.locator) {
            this.locatorInfoEl.textContent = '无目标元素';
            return;
        }
        this.locatorInfoEl.textContent = step.locator.humanDescription || step.locator.cssSelector || '已设置定位对象';
    }

    private getStepHint(): string {
        const step = this.currentStep;
        const firstAnno = step.annotations?.[0];
        if (firstAnno && firstAnno.type === 'text') {
            return firstAnno.content;
        }
        return '';
    }

    private getStepPlacement(): string {
        const step = this.currentStep;
        const firstAnno = step.annotations?.[0];
        if (firstAnno && firstAnno.type === 'text') {
            return firstAnno.position.placement;
        }
        return 'bottom';
    }

    private updateStepHint(val: string): void {
        if (!this.currentStep.annotations) this.currentStep.annotations = [];
        if (this.currentStep.annotations.length === 0) {
            this.currentStep.annotations.push({
                id: 'anno-0',
                type: 'text',
                content: val,
                position: { anchor: this.currentStep.type === 'message' ? 'screen' : 'target', placement: 'bottom' }
            });
        } else {
            const firstAnno = this.currentStep.annotations[0];
            if (firstAnno.type === 'text') {
                firstAnno.content = val;
            }
        }
    }

    private updateStepPlacement(placement: 'top' | 'bottom' | 'left' | 'right' | 'center'): void {
        if (!this.currentStep.annotations) this.currentStep.annotations = [];
        if (this.currentStep.annotations.length === 0) {
            this.currentStep.annotations.push({
                id: 'anno-0',
                type: 'text',
                content: '',
                position: { anchor: this.currentStep.type === 'message' ? 'screen' : 'target', placement }
            });
        } else {
            const firstAnno = this.currentStep.annotations[0];
            if (firstAnno.type === 'text') {
                firstAnno.position.placement = placement;
            }
        }
    }

    private addArrowEditingUI(container: HTMLElement): void {
        const arrowGroup = document.createElement('div');
        arrowGroup.className = 'demo-maker-editor-field';

        const label = document.createElement('label');
        label.innerHTML = '➡️ 箭头标注:';
        arrowGroup.appendChild(label);

        const arrow = this.currentStep.annotations?.find(a => a.type === 'arrow') as any;

        if (!arrow) {
            const addBtn = document.createElement('button');
            addBtn.className = 'demo-maker-repick-btn';
            addBtn.textContent = '添加指引箭头';
            addBtn.onclick = () => {
                if (!this.currentStep.annotations) this.currentStep.annotations = [];
                this.currentStep.annotations.push({
                    id: 'arrow-' + Date.now(),
                    type: 'arrow',
                    from: { x: 10, y: 10, anchor: 'screen' },
                    to: { x: 50, y: 50, anchor: 'target' }
                });
                // 重新初始化 UI 以显示编辑项
                const parent = this.container.parentElement;
                if (parent) {
                    this.container.remove();
                    this.initUI();
                    parent.appendChild(this.container);
                }
                this.callbacks.onPreview(this.currentStep);
            };
            arrowGroup.appendChild(addBtn);
        } else {
            // 起点编辑
            const fromRow = document.createElement('div');
            fromRow.style.display = 'flex';
            fromRow.style.alignItems = 'center';
            fromRow.style.gap = '8px';
            fromRow.innerHTML = `<span style="font-size:11px; width:45px">起点(%)</span>`;

            const fx = this.createNumberInput(arrow.from.x, (val) => { arrow.from.x = val; this.callbacks.onPreview(this.currentStep); });
            const fy = this.createNumberInput(arrow.from.y, (val) => { arrow.from.y = val; this.callbacks.onPreview(this.currentStep); });
            fromRow.appendChild(fx);
            fromRow.appendChild(fy);

            // 终点编辑
            const toRow = document.createElement('div');
            toRow.style.display = 'flex';
            toRow.style.alignItems = 'center';
            toRow.style.gap = '8px';
            toRow.innerHTML = `<span style="font-size:11px; width:45px">终点(%)</span>`;

            const tx = this.createNumberInput(arrow.to.x, (val) => { arrow.to.x = val; this.callbacks.onPreview(this.currentStep); });
            const ty = this.createNumberInput(arrow.to.y, (val) => { arrow.to.y = val; this.callbacks.onPreview(this.currentStep); });
            toRow.appendChild(tx);
            toRow.appendChild(ty);

            this.arrowInputs = { fx, fy, tx, ty };

            const delBtn = document.createElement('button');
            delBtn.textContent = '删除箭头';
            delBtn.className = 'demo-maker-exit-btn';
            delBtn.style.padding = '2px 8px';
            delBtn.style.fontSize = '10px';
            delBtn.style.marginTop = '4px';
            delBtn.onclick = () => {
                this.currentStep.annotations = this.currentStep.annotations?.filter(a => a.type !== 'arrow');
                const parent = this.container.parentElement;
                if (parent) {
                    this.container.remove();
                    this.initUI();
                    parent.appendChild(this.container);
                }
                this.callbacks.onPreview(this.currentStep);
            };

            arrowGroup.appendChild(fromRow);
            arrowGroup.appendChild(toRow);
            arrowGroup.appendChild(delBtn);
        }

        container.appendChild(arrowGroup);
    }

    /**
     * 更新标注数值（供外部拖拽同步使用）
     */
    updateAnnotation(anno: ArrowAnnotation): void {
        const arrow = this.currentStep.annotations?.find(a => a.id === anno.id) as ArrowAnnotation | undefined;
        if (arrow && arrow.type === 'arrow') {
            arrow.from.x = anno.from.x;
            arrow.from.y = anno.from.y;
            arrow.to.x = anno.to.x;
            arrow.to.y = anno.to.y;

            // 更新输入框数值
            if (this.arrowInputs) {
                this.arrowInputs.fx.value = this.formatCoord(arrow.from.x);
                this.arrowInputs.fy.value = this.formatCoord(arrow.from.y);
                this.arrowInputs.tx.value = this.formatCoord(arrow.to.x);
                this.arrowInputs.ty.value = this.formatCoord(arrow.to.y);
            }
        }
    }

    private formatCoord(val: number): string {
        // 如果是 0-1 的小数，保留 3 位
        if (Math.abs(val) <= 1 && val !== 0) {
            return val.toFixed(3);
        }
        return Math.round(val).toString();
    }

    private createNumberInput(value: number, onChange: (val: number) => void): HTMLInputElement {
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'demo-maker-editor-input';
        input.style.flex = '1';
        input.style.padding = '2px 4px';
        input.value = value.toString();
        input.oninput = () => onChange(parseFloat(input.value) || 0);
        return input;
    }

    private addTypeSpecificFields(container: HTMLElement): void {
        if (this.currentStep.type === 'select') {
            const group = document.createElement('div');
            group.className = 'demo-maker-editor-field';
            group.innerHTML = `<label>期望选中的值:</label>`;

            this.expectedInput = document.createElement('input');
            this.expectedInput.type = 'text';
            this.expectedInput.className = 'demo-maker-editor-input';
            this.expectedInput.value = this.currentStep.expectedValue || '';
            this.expectedInput.oninput = () => {
                if (this.currentStep.type === 'select') {
                    this.currentStep.expectedValue = this.expectedInput?.value || '';
                }
            };

            group.appendChild(this.expectedInput);
            container.appendChild(group);
        }
    }

    /**
     * 更新步骤的定位器（由拾取器返回）
     */
    updateLocator(locator: any): void {
        if ('locator' in this.currentStep) {
            this.currentStep.locator = locator;
            this.updateLocatorInfo();
        }
    }

    show(): void {
        document.body.appendChild(this.container);
    }

    hide(): void {
        this.container.remove();
    }

    contains(element: HTMLElement): boolean {
        return this.container.contains(element);
    }

    // 拖拽相关
    private startDrag(e: MouseEvent): void {
        this.isDragging = true;
        const rect = this.container.getBoundingClientRect();
        this.dragOffset = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        };
        e.preventDefault();
    }

    private onDrag(e: MouseEvent): void {
        if (!this.isDragging) return;
        this.container.style.left = `${e.clientX - this.dragOffset.x}px`;
        this.container.style.top = `${e.clientY - this.dragOffset.y}px`;
        this.container.style.transform = 'none';
        this.container.style.bottom = 'auto';
        this.container.style.right = 'auto';
    }

    private endDrag(): void {
        this.isDragging = false;
    }
}
