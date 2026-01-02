/**
 * Demo Maker - 编辑服务
 * 负责管理编辑状态、拾取元素以及与播放器的交互
 */

import { App, Notice } from 'obsidian';
import { FlowStep, Locator, ArrowAnnotation } from '../core/types';
import { EditorPanel } from './EditorPanel';
import { buildLocatorFromElement } from '../recorder/RecorderService';

export interface EditorServiceCallbacks {
    onSave: (step: FlowStep) => void;
    onCancel: () => void;
    onPreview: (step: FlowStep) => void;
    onPickingModeChange?: (active: boolean) => void;
}

export class EditorService {
    private app: App;
    private panel: EditorPanel | null = null;
    private isPicking = false;
    private callbacks: EditorServiceCallbacks | null = null;

    // 拾取时的处理器
    private pickHandler: ((evt: MouseEvent) => void) | null = null;
    private hoverHandler: ((evt: MouseEvent) => void) | null = null;
    private highlightEl: HTMLDivElement | null = null;

    constructor(app: App) {
        this.app = app;
    }

    /**
     * 进入编辑模式
     */
    startEditing(step: FlowStep, callbacks: EditorServiceCallbacks): void {
        this.callbacks = callbacks;

        this.panel = new EditorPanel(step, {
            onSave: (updatedStep) => this.handleSave(updatedStep),
            onCancel: () => this.handleCancel(),
            onRePickElement: () => this.startPicking(),
            onPreview: (updatedStep) => this.callbacks?.onPreview(updatedStep)
        });

        this.panel.show();
    }

    /**
     * 开始拾取新元素
     */
    private startPicking(): void {
        if (this.isPicking) return;

        this.isPicking = true;
        this.callbacks?.onPickingModeChange?.(true); // 通知播放器隐藏遮罩
        new Notice('拾取模式：请点击界面元素以重新选择');

        // 创建临时高亮框
        this.highlightEl = document.createElement('div');
        this.highlightEl.className = 'demo-maker-picker-highlight';
        const label = document.createElement('div');
        label.className = 'demo-maker-picker-label';
        this.highlightEl.appendChild(label);
        document.body.appendChild(this.highlightEl);

        // 悬停高亮逻辑
        this.hoverHandler = (evt: MouseEvent) => {
            const target = evt.target as HTMLElement;
            if (!target || this.panel?.contains(target)) {
                if (this.highlightEl) this.highlightEl.style.display = 'none';
                return;
            }

            const rect = target.getBoundingClientRect();
            if (this.highlightEl) {
                this.highlightEl.style.display = 'flex';
                this.highlightEl.style.top = `${rect.top}px`;
                this.highlightEl.style.left = `${rect.left}px`;
                this.highlightEl.style.width = `${rect.width}px`;
                this.highlightEl.style.height = `${rect.height}px`;

                const labelEl = this.highlightEl.querySelector('.demo-maker-picker-label');
                if (labelEl) {
                    labelEl.textContent = `${target.tagName.toLowerCase()}${target.id ? '#' + target.id : ''}${target.className ? '.' + target.className.split(' ').join('.') : ''}`;
                }
            }
        };

        // 点击拦截逻辑
        this.pickHandler = (evt: MouseEvent) => {
            evt.preventDefault();
            evt.stopPropagation();

            const target = evt.target as HTMLElement;
            if (!target || this.panel?.contains(target)) return;

            const newLocator = buildLocatorFromElement(target);
            this.panel?.updateLocator(newLocator);

            this.stopPicking();
            new Notice('目标元素已更新');
            // 更新预览
            if (this.panel) {
                const step = (this.panel as any).currentStep;
                this.callbacks?.onPreview(step);
            }
        };

        window.addEventListener('mouseover', this.hoverHandler, true);
        window.addEventListener('click', this.pickHandler, true);
        document.body.addClass('demo-maker-picking-mode');
    }

    /**
     * 停止拾取
     */
    private stopPicking(): void {
        if (this.hoverHandler) {
            window.removeEventListener('mouseover', this.hoverHandler, true);
            this.hoverHandler = null;
        }
        if (this.pickHandler) {
            window.removeEventListener('click', this.pickHandler, true);
            this.pickHandler = null;
        }
        if (this.highlightEl) {
            this.highlightEl.remove();
            this.highlightEl = null;
        }
        this.isPicking = false;
        this.callbacks?.onPickingModeChange?.(false); // 通知播放器恢复遮罩
        document.body.removeClass('demo-maker-picking-mode');
    }

    private handleSave(updatedStep: FlowStep): void {
        this.stopPicking();
        this.panel?.hide();
        this.panel = null;
        this.callbacks?.onSave(updatedStep);
    }

    private handleCancel(): void {
        this.stopPicking();
        this.panel?.hide();
        this.panel = null;
        this.callbacks?.onCancel();
    }

    /**
     * 检查元素是否属于编辑面板
     */
    contains(element: HTMLElement): boolean {
        return this.panel ? this.panel.contains(element) : false;
    }

    /**
     * 处理标注拖拽更新
     */
    handleAnnotationDrag(anno: ArrowAnnotation): void {
        if (this.panel) {
            this.panel.updateAnnotation(anno);
        }
    }

    /**
     * 检查是否处于编辑状态
     */
    isEditing(): boolean {
        return this.panel !== null;
    }
}
