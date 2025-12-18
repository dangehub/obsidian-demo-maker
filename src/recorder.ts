import { Notice, Plugin } from "obsidian";
import { buildSelectorSet } from "./selector";
import { ClickStep, FlowDefinition, FlowStep, WaitStep } from "./types";

type FlowSaveHandler = (flow: FlowDefinition) => Promise<void>;

const randomId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

class RecordingBar {
	private container: HTMLDivElement;
	private statusEl: HTMLSpanElement;
	constructor(
		private addWait: () => void,
		private finish: () => void,
		private cancel: () => void,
	) {
		this.container = document.createElement("div");
		this.container.className = "demo-maker-recording-bar";
		this.statusEl = document.createElement("span");
		this.statusEl.className = "demo-maker-recording-status";
		this.statusEl.textContent = "录制中...";

		const buttonRow = document.createElement("div");
		buttonRow.className = "demo-maker-recording-actions";

		const waitBtn = document.createElement("button");
		waitBtn.textContent = "插入等待";
		waitBtn.onclick = this.addWait;

		const finishBtn = document.createElement("button");
		finishBtn.textContent = "结束并保存";
		finishBtn.onclick = this.finish;

		const cancelBtn = document.createElement("button");
		cancelBtn.textContent = "取消";
		cancelBtn.onclick = this.cancel;

		buttonRow.append(waitBtn, finishBtn, cancelBtn);
		this.container.append(this.statusEl, buttonRow);
		document.body.appendChild(this.container);
	}

	contains(target: HTMLElement | null) {
		if (!target) return false;
		return this.container.contains(target);
	}

	updateStatus(text: string) {
		this.statusEl.textContent = text;
	}

	destroy() {
		this.container.remove();
	}
}

export class FlowRecorder {
	private plugin: Plugin;
	private onSave: FlowSaveHandler;
	private steps: FlowStep[] = [];
	private recordingBar: RecordingBar | null = null;
	private clickHandler: ((evt: MouseEvent) => void) | null = null;
	private flowName = "";
	private active = false;

	constructor(plugin: Plugin, onSave: FlowSaveHandler) {
		this.plugin = plugin;
		this.onSave = onSave;
	}

	isRecording() {
		return this.active;
	}

	start(flowName?: string) {
		if (this.active) {
			new Notice("已经在录制中");
			return;
		}
		this.flowName = flowName || `录制于 ${new Date().toLocaleString()}`;
		this.steps = [];
		this.active = true;
		this.recordingBar = new RecordingBar(
			() => this.addWaitStep(),
			() => this.finishRecording(),
			() => this.cancelRecording(),
		);
		this.clickHandler = (evt: MouseEvent) => this.handleClick(evt);
		document.addEventListener("click", this.clickHandler, true);
		new Notice("开始录制，点击界面生成步骤。");
	}

	private handleClick(evt: MouseEvent) {
		if (!this.active) return;
		const target = evt.target as HTMLElement | null;
		if (!target) return;
		if (this.recordingBar?.contains(target)) return;

		const selector = buildSelectorSet(target);
		const textHint = (target.innerText || target.getAttribute("aria-label") || "").trim();
		const step: ClickStep = {
			id: randomId("step"),
			type: "click",
			selector,
			textHint: textHint || undefined,
		};
		this.steps.push(step);
		this.updateStatus();
	}

	private addWaitStep() {
		if (!this.active) return;
		const waitStep: WaitStep = {
			id: randomId("step"),
			type: "wait",
			durationMs: 800,
		};
		this.steps.push(waitStep);
		this.updateStatus();
	}

	private updateStatus() {
		if (!this.recordingBar) return;
		this.recordingBar.updateStatus(`录制中，步骤数：${this.steps.length}`);
	}

	private async finishRecording() {
		if (!this.active) return;
		if (!this.steps.length) {
			new Notice("没有步骤，已取消保存。");
			return this.cancelRecording();
		}
		const flow: FlowDefinition = {
			id: randomId("flow"),
			name: this.flowName,
			createdAt: Date.now(),
			steps: this.steps,
		};
		await this.onSave(flow);
		new Notice(`已保存流程：${flow.name}`);
		this.teardown();
	}

	cancelRecording() {
		if (!this.active) return;
		new Notice("录制已取消。");
		this.teardown();
	}

	stopOnUnload() {
		if (!this.active) return;
		this.teardown();
	}

	private teardown() {
		this.active = false;
		if (this.clickHandler) {
			document.removeEventListener("click", this.clickHandler, true);
			this.clickHandler = null;
		}
		if (this.recordingBar) {
			this.recordingBar.destroy();
			this.recordingBar = null;
		}
		this.steps = [];
	}
}
