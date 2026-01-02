/**
 * Demo Maker - 编辑面板 (v2 - 简化版)
 * 只提供工具栏按钮，批注在 Overlay 上直接编辑
 */

import { FlowStep, ClickStep, InputStep, SelectStep, TextAnnotation, ArrowAnnotation, Annotation } from '../core/types';

export interface EditorPanelCallbacks {
    onSave: (step: FlowStep) => void;
    onCancel: () => void;
    onRePickElement: () => void;
    onPreview: (step: FlowStep) => void;
    onAddAnnotation?: (anno: Annotation) => void;
    onDeleteAnnotation?: (id: string) => void;
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
    private expectedInput?: HTMLInputElement;

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
        header.innerHTML = `<span>✏️ 编辑步骤</span>`;

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

        // 批注工具栏
        const toolbarGroup = document.createElement('div');
        toolbarGroup.className = 'demo-maker-editor-field';
        const toolbarLabel = document.createElement('label');
        toolbarLabel.textContent = '批注工具:';
        toolbarGroup.appendChild(toolbarLabel);

        const toolbar = document.createElement('div');
        toolbar.style.display = 'flex';
        toolbar.style.gap = '8px';
        toolbar.style.marginTop = '8px';

        const addTextBtn = document.createElement('button');
        addTextBtn.className = 'demo-maker-repick-btn';
        addTextBtn.textContent = '+ 文字';
        addTextBtn.onclick = () => this.addTextAnnotation();

        const addArrowBtn = document.createElement('button');
        addArrowBtn.className = 'demo-maker-repick-btn';
        addArrowBtn.textContent = '+ 箭头';
        addArrowBtn.onclick = () => this.addArrowAnnotation();

        toolbar.appendChild(addTextBtn);
        toolbar.appendChild(addArrowBtn);
        toolbarGroup.appendChild(toolbar);

        // 组装内容
        content.appendChild(this.typeInfoEl);
        content.appendChild(locatorGroup);

        // 针对特殊类型的额外字段 (如 Select 的期望值)
        this.addTypeSpecificFields(content);

        content.appendChild(toolbarGroup);

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

    private addTextAnnotation(): void {
        if (!this.currentStep.annotations) this.currentStep.annotations = [];
        const newAnno: TextAnnotation = {
            id: 'text-' + Date.now(),
            type: 'text',
            content: '新批注',
            position: {
                anchor: this.currentStep.type === 'message' ? 'screen' : 'target',
                placement: 'bottom',
                offsetX: 0,
                offsetY: 0
            },
            style: { theme: 'default' }
        };
        this.currentStep.annotations.push(newAnno);
        this.callbacks.onAddAnnotation?.(newAnno);
        this.callbacks.onPreview(this.currentStep);
    }

    private addArrowAnnotation(): void {
        if (!this.currentStep.annotations) this.currentStep.annotations = [];
        const newAnno: ArrowAnnotation = {
            id: 'arrow-' + Date.now(),
            type: 'arrow',
            from: { x: 0.1, y: 0.1, anchor: 'screen' },
            to: { x: 50, y: 50, anchor: 'target' }
        };
        this.currentStep.annotations.push(newAnno);
        this.callbacks.onAddAnnotation?.(newAnno);
        this.callbacks.onPreview(this.currentStep);
    }

    /**
     * 删除批注（由 Overlay 触发）
     */
    deleteAnnotation(id: string): void {
        if (!this.currentStep.annotations) return;
        this.currentStep.annotations = this.currentStep.annotations.filter(a => a.id !== id);
        this.callbacks.onPreview(this.currentStep);
    }

    /**
     * 更新批注内容（由 Overlay 内联编辑触发）
     */
    updateAnnotationContent(id: string, content: string): void {
        const anno = this.currentStep.annotations?.find(a => a.id === id);
        if (anno && anno.type === 'text') {
            (anno as TextAnnotation).content = content;
            this.callbacks.onPreview(this.currentStep);
        }
    }

    /**
     * 更新标注数值（供外部拖拽同步使用）
     */
    updateAnnotation(anno: ArrowAnnotation | TextAnnotation): void {
        const existing = this.currentStep.annotations?.find(a => a.id === anno.id);
        if (existing && existing.type === 'arrow' && anno.type === 'arrow') {
            (existing as ArrowAnnotation).from = anno.from;
            (existing as ArrowAnnotation).to = anno.to;
        } else if (existing && existing.type === 'text' && anno.type === 'text') {
            (existing as TextAnnotation).position = anno.position;
        }
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

    /**
     * 获取当前编辑中的步骤
     */
    getStep(): FlowStep {
        return this.currentStep;
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
