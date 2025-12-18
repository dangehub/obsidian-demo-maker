import { Notice, Plugin } from "obsidian";
import { FlowPlayer } from "./src/player";
import { FlowRecorder } from "./src/recorder";
import { checkSelectors } from "./src/debug";
import { DemoMakerData, FlowDefinition } from "./src/types";

const DEFAULT_DATA: DemoMakerData = {
	flows: [],
};

export default class DemoMakerPlugin extends Plugin {
	private data: DemoMakerData = DEFAULT_DATA;
	private recorder: FlowRecorder | null = null;
	private player: FlowPlayer | null = null;
	private editMode = false;

	async onload() {
		await this.loadState();
		this.recorder = new FlowRecorder(this, (flow) => this.saveFlow(flow));
		this.player = new FlowPlayer(this, (flow) => this.saveEditedFlow(flow));

		this.addCommand({
			id: "demo-maker-start-recording",
			name: "开始录制引导流程",
			callback: () => this.startRecording(),
		});

		this.addCommand({
			id: "demo-maker-play-last",
			name: "回放最近录制的流程",
			callback: () => this.playLastFlow(),
		});

		this.addCommand({
			id: "demo-maker-debug-last",
			name: "调试最近录制的定位",
			callback: () => this.debugLastFlowSelectors(),
		});

		this.addCommand({
			id: "demo-maker-toggle-edit-mode",
			name: "切换回放编辑模式（添加提示/箭头）",
			callback: () => this.toggleEditMode(),
		});

		new Notice("Demo Maker 插件已加载（最小原型）。");
	}

	onunload() {
		this.recorder?.stopOnUnload();
		this.player?.stopOnUnload();
	}

	private async loadState() {
		const saved = await this.loadData();
		this.data = Object.assign({}, DEFAULT_DATA, saved);
		if (!this.data.flows) {
			this.data.flows = [];
		}
	}

	private async saveState() {
		await this.saveData(this.data);
	}

	private async saveFlow(flow: FlowDefinition) {
		const existing = this.data.flows.filter((f) => f.id !== flow.id);
		this.data.flows = [flow, ...existing].slice(0, 5);
		this.data.lastRecordedId = flow.id;
		await this.saveState();
	}

	private startRecording() {
		if (!this.recorder) return;
		if (this.player?.isPlaying()) {
			this.player.stop("已停止当前回放，开始录制。");
		}
		this.recorder.start();
	}

	private playLastFlow() {
		if (!this.player) return;
		const flow = this.getLastFlow();
		if (!flow) {
			new Notice("还没有录制流程。");
			return;
		}
		if (this.recorder?.isRecording()) {
			this.recorder.cancelRecording();
		}
		this.player.setEditMode(this.editMode);
		this.player.start(flow);
	}

	private getLastFlow(): FlowDefinition | null {
		if (!this.data.lastRecordedId) {
			return this.data.flows[0] ?? null;
		}
		return this.data.flows.find((f) => f.id === this.data.lastRecordedId) ?? null;
	}

	private debugLastFlowSelectors() {
		const flow = this.getLastFlow();
		if (!flow) {
			new Notice("还没有录制流程。");
			return;
		}
		const results = checkSelectors(flow);
		console.table(results);
		const missing = results.filter((r) => r.count === 0);
		if (missing.length === results.length) {
			new Notice("所有候选 selector 都匹配不到元素，请检查录制上下文。");
		} else if (missing.length > 0) {
			new Notice(`有 ${missing.length} 个候选 selector 未匹配，详见控制台。`);
		} else {
			new Notice("所有候选 selector 都能匹配到元素（可能有多个匹配）。");
		}
	}

	// 对外 API：允许其他插件直接启动流程
	public startFlow(flow: FlowDefinition) {
		if (!this.player) return;
		this.player.start(flow);
	}

	private async saveEditedFlow(flow: FlowDefinition) {
		const existing = this.data.flows.filter((f) => f.id !== flow.id);
		this.data.flows = [flow, ...existing].slice(0, 5);
		this.data.lastRecordedId = flow.id;
		await this.saveState();
	}

	private toggleEditMode() {
		this.editMode = !this.editMode;
		this.player?.setEditMode(this.editMode);
		new Notice(this.editMode ? "回放编辑模式已开启（可添加提示/箭头）" : "回放编辑模式已关闭");
	}
}
