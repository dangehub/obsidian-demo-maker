/**
 * Demo Maker - 录制面板
 * 悬浮的录制控制面板
 */

export interface RecorderPanelCallbacks {
    onInsertWait: () => void;
    onInsertMessage: () => void;
    onFinish: () => void;
    onCancel: () => void;
    onPause: () => void;
    onResume: () => void;
}

/**
 * 录制控制面板
 */
export class RecorderPanel {
    private container: HTMLDivElement;
    private statusEl: HTMLSpanElement;
    private stepCountEl: HTMLSpanElement;
    private pauseBtn: HTMLButtonElement;
    private isPaused = false;
    private callbacks: RecorderPanelCallbacks;

    // 拖拽状态
    private isDragging = false;
    private dragOffset = { x: 0, y: 0 };

    constructor(callbacks: RecorderPanelCallbacks) {
        this.callbacks = callbacks;

        // 创建容器
        this.container = document.createElement('div');
        this.container.className = 'demo-maker-recorder-panel';

        // 创建标题栏（可拖拽）
        const header = document.createElement('div');
        header.className = 'demo-maker-recorder-header';

        const indicator = document.createElement('span');
        indicator.className = 'demo-maker-recorder-indicator';
        indicator.textContent = '🔴';

        this.statusEl = document.createElement('span');
        this.statusEl.className = 'demo-maker-recorder-status';
        this.statusEl.textContent = '录制中';

        this.stepCountEl = document.createElement('span');
        this.stepCountEl.className = 'demo-maker-recorder-count';
        this.stepCountEl.textContent = '步骤: 0';

        header.appendChild(indicator);
        header.appendChild(this.statusEl);
        header.appendChild(this.stepCountEl);

        // 创建按钮行
        const actions = document.createElement('div');
        actions.className = 'demo-maker-recorder-actions';

        const waitBtn = document.createElement('button');
        waitBtn.textContent = '插入等待';
        waitBtn.onclick = () => this.callbacks.onInsertWait();

        const messageBtn = document.createElement('button');
        messageBtn.textContent = '插入提示';
        messageBtn.onclick = () => this.callbacks.onInsertMessage();

        this.pauseBtn = document.createElement('button');
        this.pauseBtn.textContent = '暂停';
        this.pauseBtn.onclick = () => this.togglePause();

        actions.appendChild(waitBtn);
        actions.appendChild(messageBtn);
        actions.appendChild(this.pauseBtn);

        // 创建底部按钮
        const footer = document.createElement('div');
        footer.className = 'demo-maker-recorder-footer';

        const finishBtn = document.createElement('button');
        finishBtn.className = 'demo-maker-recorder-finish';
        finishBtn.textContent = '结束并保存';
        finishBtn.onclick = () => this.callbacks.onFinish();

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'demo-maker-recorder-cancel';
        cancelBtn.textContent = '取消';
        cancelBtn.onclick = () => this.callbacks.onCancel();

        footer.appendChild(finishBtn);
        footer.appendChild(cancelBtn);

        // 组装
        this.container.appendChild(header);
        this.container.appendChild(actions);
        this.container.appendChild(footer);

        // 绑定拖拽事件
        header.onmousedown = (e) => this.startDrag(e);
        document.addEventListener('mousemove', (e) => this.onDrag(e));
        document.addEventListener('mouseup', () => this.endDrag());
    }

    /**
     * 显示面板
     */
    show(): void {
        document.body.appendChild(this.container);
    }

    /**
     * 隐藏面板
     */
    hide(): void {
        this.container.remove();
    }

    /**
     * 检查元素是否在面板内
     */
    contains(element: HTMLElement): boolean {
        return this.container.contains(element);
    }

    /**
     * 更新步骤计数
     */
    updateStepCount(count: number): void {
        this.stepCountEl.textContent = `步骤: ${count}`;
    }

    /**
     * 切换暂停状态
     */
    private togglePause(): void {
        this.isPaused = !this.isPaused;
        if (this.isPaused) {
            this.statusEl.textContent = '已暂停';
            this.pauseBtn.textContent = '继续';
            this.container.classList.add('paused');
            this.callbacks.onPause();
        } else {
            this.statusEl.textContent = '录制中';
            this.pauseBtn.textContent = '暂停';
            this.container.classList.remove('paused');
            this.callbacks.onResume();
        }
    }

    /**
     * 获取暂停状态
     */
    getPaused(): boolean {
        return this.isPaused;
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
    }

    private endDrag(): void {
        this.isDragging = false;
    }
}
