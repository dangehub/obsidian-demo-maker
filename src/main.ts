/**
 * Demo Maker - Obsidian 嵌入式新手引导插件
 * 
 * 用于创建交互式新手引导体验，帮助用户学习插件或工作流。
 */

import { Notice, Plugin, FuzzySuggestModal } from 'obsidian';
import { FlowDefinition, DemoMakerData, DEFAULT_DATA } from './core/types';
import { FlowManager } from './core/FlowManager';
import { PlayerService } from './player/PlayerService';
import { RecorderService } from './recorder/RecorderService';

/**
 * 流程选择弹窗
 */
class FlowSelectModal extends FuzzySuggestModal<FlowDefinition> {
    private flows: FlowDefinition[];
    private onSelect: (flow: FlowDefinition) => void;

    constructor(app: Plugin['app'], flows: FlowDefinition[], onSelect: (flow: FlowDefinition) => void) {
        super(app);
        this.flows = flows;
        this.onSelect = onSelect;
        this.setPlaceholder('选择要播放的引导流程...');
    }

    getItems(): FlowDefinition[] {
        return this.flows;
    }

    getItemText(flow: FlowDefinition): string {
        return flow.name;
    }

    onChooseItem(flow: FlowDefinition): void {
        this.onSelect(flow);
    }
}

/**
 * Demo Maker 插件主类
 */
export default class DemoMakerPlugin extends Plugin {
    private data: DemoMakerData = DEFAULT_DATA;
    private flowManager!: FlowManager;
    private player!: PlayerService;
    private recorder!: RecorderService;

    async onload(): Promise<void> {
        console.log('Demo Maker: 加载中...');

        // 加载数据
        await this.loadPluginData();

        // 初始化管理器
        this.flowManager = new FlowManager(this);
        this.player = new PlayerService(this, {
            onStart: (flow) => {
                console.log('Demo Maker: 开始播放', flow.name);
            },
            onEnd: (flow, completed) => {
                console.log('Demo Maker: 播放结束', flow.name, completed ? '完成' : '中断');
            },
            onStepChange: (step, index) => {
                console.log('Demo Maker: 步骤', index + 1, step.type);
            },
        });
        this.recorder = new RecorderService(this.app, this.flowManager);

        // 注册命令
        this.addCommand({
            id: 'demo-maker-play-flow',
            name: '播放引导流程',
            callback: () => this.showFlowSelector(),
        });

        this.addCommand({
            id: 'demo-maker-stop-flow',
            name: '停止当前引导',
            callback: () => {
                if (this.player.isPlaying()) {
                    this.player.stop('已停止引导');
                } else {
                    new Notice('当前没有正在播放的引导');
                }
            },
        });

        // 录制命令
        this.addCommand({
            id: 'demo-maker-start-recording',
            name: '开始录制引导流程',
            callback: () => {
                if (this.player.isPlaying()) {
                    this.player.stop();
                }
                this.recorder.start();
            },
        });

        this.addCommand({
            id: 'demo-maker-stop-recording',
            name: '停止录制',
            callback: () => {
                if (this.recorder.getIsRecording()) {
                    this.recorder.stop();
                    new Notice('已停止录制');
                } else {
                    new Notice('当前没有正在进行的录制');
                }
            },
        });

        // 开发调试命令：播放示例流程
        this.addCommand({
            id: 'demo-maker-play-demo',
            name: '播放示例流程 (Demo)',
            callback: () => this.playDemoFlow(),
        });

        new Notice('Demo Maker 已加载');
        console.log('Demo Maker: 加载完成');
    }

    onunload(): void {
        this.player.onUnload();
        this.recorder.onUnload();
        console.log('Demo Maker: 已卸载');
    }

    /**
     * 加载插件数据
     */
    private async loadPluginData(): Promise<void> {
        const saved = await this.loadData();
        this.data = Object.assign({}, DEFAULT_DATA, saved);
    }

    /**
     * 保存插件数据
     */
    private async savePluginData(): Promise<void> {
        await this.saveData(this.data);
    }

    /**
     * 显示流程选择器
     */
    private async showFlowSelector(): Promise<void> {
        const flows = await this.flowManager.listFlows();

        if (flows.length === 0) {
            new Notice('没有可用的引导流程。请先创建一个流程，或将流程文件放入 flows 目录。');
            return;
        }

        new FlowSelectModal(this.app, flows, (flow) => {
            this.player.start(flow);
        }).open();
    }

    /**
     * 播放示例流程（用于开发测试）
     */
    private async playDemoFlow(): Promise<void> {
        // 尝试加载 demo 流程
        const demoFlow = await this.flowManager.loadFlow('demo');

        if (demoFlow) {
            this.player.start(demoFlow);
        } else {
            new Notice('未找到示例流程 (demo.json)。请确保文件存在于 flows 目录中。');
        }
    }

    // ============================================================
    // 对外 API（供其他插件调用）
    // ============================================================

    /**
     * 获取 API 对象
     */
    get api() {
        return {
            /**
             * 播放指定 ID 的流程
             */
            playFlow: async (flowId: string): Promise<boolean> => {
                const flow = await this.flowManager.loadFlow(flowId);
                if (flow) {
                    await this.player.start(flow);
                    return true;
                }
                return false;
            },

            /**
             * 直接播放流程定义
             */
            playFlowDefinition: async (flow: FlowDefinition): Promise<void> => {
                await this.player.start(flow);
            },

            /**
             * 停止当前播放
             */
            stopFlow: (): void => {
                this.player.stop();
            },

            /**
             * 检查是否正在播放
             */
            isPlaying: (): boolean => {
                return this.player.isPlaying();
            },
        };
    }
}
