import { Notice, Plugin } from "obsidian";
import { resolveClickTarget } from "./selector";
import { FlowDefinition, FlowStep } from "./types";

class PlayerOverlay {
	private container: HTMLDivElement;
	private highlight: HTMLDivElement;
	private tooltip: HTMLDivElement;
	private exitButton: HTMLButtonElement;

	constructor(onExit: () => void) {
		this.container = document.createElement("div");
		this.container.className = "demo-maker-overlay";

		this.highlight = document.createElement("div");
		this.highlight.className = "demo-maker-overlay-highlight";

		this.tooltip = document.createElement("div");
		this.tooltip.className = "demo-maker-overlay-tooltip";

		this.exitButton = document.createElement("button");
		this.exitButton.className = "demo-maker-overlay-exit";
		this.exitButton.textContent = "退出引导";
		this.exitButton.onclick = onExit;

		this.container.append(this.highlight, this.tooltip, this.exitButton);
		document.body.appendChild(this.container);
	}

	contains(target: HTMLElement | null) {
		if (!target) return false;
		return this.container.contains(target);
	}

	showStep(target: HTMLElement, message: string) {
		const rect = target.getBoundingClientRect();
		this.highlight.style.display = "block";
		this.highlight.style.top = `${rect.top + window.scrollY - 4}px`;
		this.highlight.style.left = `${rect.left + window.scrollX - 4}px`;
		this.highlight.style.width = `${rect.width + 8}px`;
		this.highlight.style.height = `${rect.height + 8}px`;
		this.tooltip.textContent = message;
		this.tooltip.style.display = "block";
	}

	showWait(message: string) {
		this.highlight.style.display = "none";
		this.tooltip.textContent = message;
		this.tooltip.style.display = "block";
	}

	destroy() {
		this.container.remove();
	}
}

export class FlowPlayer {
	private plugin: Plugin;
	private overlay: PlayerOverlay | null = null;
	private flow: FlowDefinition | null = null;
	private index = 0;
	private active = false;
	private currentTarget: HTMLElement | null = null;
	private timeoutHandle: number | null = null;
	private pollHandle: number | null = null;
	private clickHandler: ((evt: MouseEvent) => void) | null = null;
	private keyHandler: ((evt: KeyboardEvent) => void) | null = null;
	private readonly maxResolveAttempts = 20;
	private readonly resolveInterval = 300; // ms
	private readonly clickAdvanceDelayMs = 200;

	constructor(plugin: Plugin) {
		this.plugin = plugin;
	}

	isPlaying() {
		return this.active;
	}

	start(flow: FlowDefinition) {
		if (this.active) {
			this.stop("正在播放，已重置。");
		}
		this.flow = flow;
		this.index = 0;
		this.active = true;
		this.overlay = new PlayerOverlay(() => this.stop("已退出引导"));
		this.bindListeners();
		this.nextStep();
	}

	private bindListeners() {
		this.clickHandler = (evt: MouseEvent) => this.handleClick(evt);
		this.keyHandler = (evt: KeyboardEvent) => this.handleKey(evt);
		document.addEventListener("click", this.clickHandler, true);
		document.addEventListener("keydown", this.keyHandler, true);
	}

	private handleKey(evt: KeyboardEvent) {
		if (!this.active) return;
		if (evt.key === "Escape") {
			evt.preventDefault();
			this.stop("已退出引导");
		}
	}

	private handleClick(evt: MouseEvent) {
		if (!this.active) return;
		const target = evt.target as HTMLElement | null;
		if (!target) return;
		if (this.overlay?.contains(target)) return;
		if (!this.currentTarget) {
			evt.stopPropagation();
			evt.preventDefault();
			return;
		}
		if (this.currentTarget.contains(target)) {
			this.advanceFromClick();
			return;
		}
		evt.stopPropagation();
		evt.preventDefault();
	}

	private advanceFromClick() {
		this.currentTarget = null;
		if (this.timeoutHandle) {
			window.clearTimeout(this.timeoutHandle);
			this.timeoutHandle = null;
		}
		this.timeoutHandle = window.setTimeout(() => {
			this.index += 1;
			this.nextStep();
		}, this.clickAdvanceDelayMs);
	}

	private nextStep() {
		if (!this.flow) return;
		this.clearTimers();
		if (this.index >= this.flow.steps.length) {
			this.stop("引导完成");
			return;
		}
		const step = this.flow.steps[this.index];
		this.renderStep(step);
	}

	private renderStep(step: FlowStep) {
		if (!this.overlay) return;
		const stepLabel = `步骤 ${this.index + 1}/${this.flow?.steps.length ?? 0}`;
		if (step.type === "wait") {
			this.currentTarget = null;
			this.overlay.showWait(`${stepLabel}：等待 ${Math.round(step.durationMs / 1000)} 秒`);
			this.timeoutHandle = window.setTimeout(() => {
				this.index += 1;
				this.nextStep();
			}, step.durationMs);
			return;
		}

		this.tryResolveTarget(step, stepLabel, 0);
	}

	private tryResolveTarget(step: FlowStep, stepLabel: string, attempt: number) {
		if (step.type !== "click") return;
		const target = resolveClickTarget(step);
		if (target) {
			this.currentTarget = target;
			this.overlay?.showStep(target, `${stepLabel}：点击高亮区域`);
			return;
		}

		if (attempt >= this.maxResolveAttempts) {
			console.warn("Demo Maker: selector 未找到", step.selector.candidates);
			new Notice("无法定位目标元素，已停止引导。");
			this.stop("定位失败");
			return;
		}

		this.pollHandle = window.setTimeout(() => {
			this.tryResolveTarget(step, stepLabel, attempt + 1);
		}, this.resolveInterval);
	}

	stop(reason?: string) {
		if (!this.active) return;
		this.clearTimers();
		if (this.clickHandler) {
			document.removeEventListener("click", this.clickHandler, true);
			this.clickHandler = null;
		}
		if (this.keyHandler) {
			document.removeEventListener("keydown", this.keyHandler, true);
			this.keyHandler = null;
		}
		if (this.overlay) {
			this.overlay.destroy();
			this.overlay = null;
		}
		this.active = false;
		this.currentTarget = null;
		this.flow = null;
		this.index = 0;
		if (reason) {
			new Notice(reason);
		}
	}

	private clearTimers() {
		if (this.timeoutHandle) {
			window.clearTimeout(this.timeoutHandle);
			this.timeoutHandle = null;
		}
		if (this.pollHandle) {
			window.clearTimeout(this.pollHandle);
			this.pollHandle = null;
		}
	}

	stopOnUnload() {
		this.stop();
	}
}
