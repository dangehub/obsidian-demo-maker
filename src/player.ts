import { Notice, Plugin, Modal, Setting } from "obsidian";
import { resolveClickTarget } from "./selector";
import { FlowDefinition, FlowStep } from "./types";

type HintDirection = "top" | "bottom" | "left" | "right";

class HintModal extends Modal {
	private textValue: string;
	private dirValue: HintDirection;
	private offsetX: number;
	private offsetY: number;
	private showText: boolean;
	private showArrow: boolean;
	private onSave: (payload: { text?: string; position: HintDirection; offsetX: number; offsetY: number; arrow: boolean }) => void;
	private onCloseCb: () => void;

	constructor(
		app: Plugin["app"],
		defaults: { text?: string; position: HintDirection; offsetX?: number; offsetY?: number; arrow?: boolean },
		onSave: (payload: { text?: string; position: HintDirection; offsetX: number; offsetY: number; arrow: boolean }) => void,
		onCloseCb: () => void,
	) {
		super(app);
		this.textValue = defaults.text ?? "";
		this.dirValue = defaults.position;
		this.offsetX = defaults.offsetX ?? 0;
		this.offsetY = defaults.offsetY ?? 0;
		this.showText = !!defaults.text;
		this.showArrow = defaults.arrow ?? true;
		this.onSave = onSave;
		this.onCloseCb = onCloseCb;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h3", { text: "添加/编辑提示" });

		let textAreaWrapper = contentEl.createDiv();

		new Setting(contentEl)
			.setName("显示提示文本")
			.addToggle((toggle) => {
				toggle.setValue(this.showText);
				toggle.onChange((value) => {
					this.showText = value;
					textAreaWrapper.toggleClass("is-hidden", !value);
				});
			});

		const textarea = textAreaWrapper.createEl("textarea");
		textarea.value = this.textValue;
		textarea.rows = 3;
		textarea.oninput = () => {
			this.textValue = textarea.value;
		};
		textAreaWrapper.toggleClass("is-hidden", !this.showText);

		new Setting(contentEl)
			.setName("显示箭头")
			.addToggle((toggle) => {
				toggle.setValue(this.showArrow);
				toggle.onChange((value) => {
					this.showArrow = value;
					dirSetting.settingEl.toggleClass("is-hidden", !value);
				});
			});

		const dirSetting = new Setting(contentEl)
			.setName("箭头方向")
			.addDropdown((dropdown) => {
				dropdown.addOptions({
					top: "top",
					bottom: "bottom",
					left: "left",
					right: "right",
				});
				dropdown.setValue(this.dirValue);
				dropdown.onChange((value) => {
					this.dirValue = (value as HintDirection) ?? "bottom";
				});
			});
		dirSetting.settingEl.toggleClass("is-hidden", !this.showArrow);

		new Setting(contentEl)
			.setName("位置偏移 X (px)")
			.setDesc("正数向右，负数向左")
			.addText((text) => {
				text.setPlaceholder("0");
				text.setValue(String(this.offsetX));
				text.onChange((value) => {
					const num = Number(value);
					this.offsetX = isNaN(num) ? 0 : num;
				});
			});

		new Setting(contentEl)
			.setName("位置偏移 Y (px)")
			.setDesc("正数向下，负数向上")
			.addText((text) => {
				text.setPlaceholder("0");
				text.setValue(String(this.offsetY));
				text.onChange((value) => {
					const num = Number(value);
					this.offsetY = isNaN(num) ? 0 : num;
				});
			});

		const buttonBar = contentEl.createDiv("demo-maker-hint-modal-buttons");
		const saveBtn = buttonBar.createEl("button", { text: "保存" });
		const clearBtn = buttonBar.createEl("button", { text: "清除提示" });
		saveBtn.onclick = () => {
			this.onSave({
				text: this.showText ? this.textValue : undefined,
				position: this.dirValue,
				offsetX: this.offsetX,
				offsetY: this.offsetY,
				arrow: this.showArrow,
			});
			this.close();
		};
		clearBtn.onclick = () => {
			this.onSave({ text: undefined, position: this.dirValue, offsetX: this.offsetX, offsetY: this.offsetY, arrow: false });
			this.close();
		};
	}

	onClose() {
		this.onCloseCb();
	}
}

class PlayerOverlay {
	private container: HTMLDivElement;
	private shade: HTMLDivElement;
	private highlight: HTMLDivElement;
	private tooltip: HTMLDivElement;
	private exitButton: HTMLButtonElement;
	private hintBubble: HTMLDivElement;
	private editButton: HTMLButtonElement;
	private toolbar: HTMLDivElement;
	private addTextBtn: HTMLButtonElement;
	private addArrowBtn: HTMLButtonElement;
	private saveBtn: HTMLButtonElement;
	private nextBtn: HTMLButtonElement;
	private editMode = false;
	private dimming = true;
	private textAnnoEl: HTMLDivElement | null = null;
	private arrowSvg: SVGSVGElement | null = null;
	private arrowLine: SVGLineElement | null = null;
	private arrowHandleStart: SVGCircleElement | null = null;
	private arrowHandleEnd: SVGCircleElement | null = null;

	constructor(onExit: () => void, onAddHint: () => void, editMode: boolean) {
		this.container = document.createElement("div");
		this.container.className = "demo-maker-overlay";

		this.shade = document.createElement("div");
		this.shade.className = "demo-maker-overlay-shade";

		this.highlight = document.createElement("div");
		this.highlight.className = "demo-maker-overlay-highlight";

		this.hintBubble = document.createElement("div");
		this.hintBubble.className = "demo-maker-overlay-hint";
		this.hintBubble.style.display = "none";

		this.tooltip = document.createElement("div");
		this.tooltip.className = "demo-maker-overlay-tooltip";

		this.exitButton = document.createElement("button");
		this.exitButton.className = "demo-maker-overlay-exit";
		this.exitButton.textContent = "退出引导";
		this.exitButton.onclick = onExit;

		this.editButton = document.createElement("button");
		this.editButton.className = "demo-maker-overlay-edit";
		this.editButton.textContent = "添加提示";
		this.editButton.onclick = onAddHint;

		this.toolbar = document.createElement("div");
		this.toolbar.className = "demo-maker-edit-toolbar";
		this.addTextBtn = document.createElement("button");
		this.addTextBtn.textContent = "添加文本";
		this.addArrowBtn = document.createElement("button");
		this.addArrowBtn.textContent = "添加箭头";
		this.saveBtn = document.createElement("button");
		this.saveBtn.textContent = "保存";
		this.nextBtn = document.createElement("button");
		this.nextBtn.textContent = "保存并下一步";
		this.toolbar.append(this.addTextBtn, this.addArrowBtn, this.saveBtn, this.nextBtn);

		this.container.append(this.shade, this.highlight, this.hintBubble, this.tooltip, this.exitButton, this.editButton, this.toolbar);
		document.body.appendChild(this.container);
		this.setEditMode(editMode);
	}

	contains(target: HTMLElement | null) {
		if (!target) return false;
		return this.container.contains(target);
	}

	showStep(target: HTMLElement, message: string, hint?: { text?: string; position: HintDirection; offsetX?: number; offsetY?: number; arrow?: boolean }) {
		this.shade.style.display = "none";
		const rect = target.getBoundingClientRect();
		this.highlight.style.display = "block";
		this.highlight.classList.toggle("no-dim", !this.dimming);
		this.highlight.style.top = `${rect.top + window.scrollY - 4}px`;
		this.highlight.style.left = `${rect.left + window.scrollX - 4}px`;
		this.highlight.style.width = `${rect.width + 8}px`;
		this.highlight.style.height = `${rect.height + 8}px`;
		this.tooltip.textContent = message;
		this.tooltip.style.display = "block";
		if (hint?.text || hint?.arrow) {
			this.showHint(rect, hint.text ?? "", hint.position ?? "bottom", hint.offsetX ?? 0, hint.offsetY ?? 0, hint.arrow ?? true);
		} else {
			this.hintBubble.style.display = "none";
		}
	}

	showWait(message: string) {
		this.shade.style.display = "block";
		this.highlight.style.display = "none";
		this.tooltip.textContent = message;
		this.tooltip.style.display = "block";
		this.hintBubble.style.display = "none";
	}

	setEditMode(editMode: boolean) {
		this.editMode = editMode;
		this.editButton.style.display = editMode ? "block" : "none";
		this.toolbar.style.display = editMode ? "flex" : "none";
	}

	destroy() {
		this.container.remove();
	}

	private showHint(rect: DOMRect, text: string, position: HintDirection, offsetX: number, offsetY: number, arrow: boolean) {
		const bubble = this.hintBubble;
		bubble.textContent = text;
		bubble.dataset.position = position;
		bubble.dataset.arrow = arrow ? "on" : "off";
		bubble.style.display = "block";
		const padding = 12;
		const xCenter = rect.left + window.scrollX + rect.width / 2;
		const yCenter = rect.top + window.scrollY + rect.height / 2;
		switch (position) {
		case "top":
			bubble.style.left = `${xCenter + offsetX}px`;
			bubble.style.top = `${rect.top + window.scrollY - padding + offsetY}px`;
			bubble.style.transform = "translate(-50%, -100%)";
			break;
		case "bottom":
			bubble.style.left = `${xCenter + offsetX}px`;
			bubble.style.top = `${rect.bottom + window.scrollY + padding + offsetY}px`;
			bubble.style.transform = "translate(-50%, 0)";
			break;
		case "left":
			bubble.style.left = `${rect.left + window.scrollX - padding + offsetX}px`;
			bubble.style.top = `${yCenter + offsetY}px`;
			bubble.style.transform = "translate(-100%, -50%)";
			break;
		case "right":
		default:
			bubble.style.left = `${rect.right + window.scrollX + padding + offsetX}px`;
			bubble.style.top = `${yCenter + offsetY}px`;
			bubble.style.transform = "translate(0, -50%)";
			break;
		}
	}

	setDimmingEnabled(enabled: boolean) {
		this.dimming = enabled;
		if (this.dimming) {
			this.highlight.classList.remove("no-dim");
		} else {
			this.highlight.classList.add("no-dim");
		}
		if (this.dimming) {
			this.shade.style.display = "block";
		} else {
			this.shade.style.display = "none";
		}
	}

	getToolbarButtons() {
		return {
			addText: this.addTextBtn,
			addArrow: this.addArrowBtn,
			save: this.saveBtn,
			next: this.nextBtn,
		};
	}

	setTextAnnotation(el: HTMLDivElement | null) {
		if (this.textAnnoEl) this.textAnnoEl.remove();
		this.textAnnoEl = el;
		if (el) this.container.appendChild(el);
	}

	setArrowAnnotation(svg: SVGSVGElement | null, line?: SVGLineElement, start?: SVGCircleElement, end?: SVGCircleElement) {
		if (this.arrowSvg) this.arrowSvg.remove();
		this.arrowSvg = svg;
		this.arrowLine = line ?? null;
		this.arrowHandleStart = start ?? null;
		this.arrowHandleEnd = end ?? null;
		if (svg) this.container.appendChild(svg);
	}

	updateArrowLine(x1: number, y1: number, x2: number, y2: number) {
		if (this.arrowLine) {
			this.arrowLine.setAttribute("x1", String(x1));
			this.arrowLine.setAttribute("y1", String(y1));
			this.arrowLine.setAttribute("x2", String(x2));
			this.arrowLine.setAttribute("y2", String(y2));
		}
		if (this.arrowHandleStart) {
			this.arrowHandleStart.setAttribute("cx", String(x1));
			this.arrowHandleStart.setAttribute("cy", String(y1));
		}
		if (this.arrowHandleEnd) {
			this.arrowHandleEnd.setAttribute("cx", String(x2));
			this.arrowHandleEnd.setAttribute("cy", String(y2));
		}
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
	private editMode = false;
	private saveFlow: ((flow: FlowDefinition) => Promise<void>) | null = null;
	private editingTargetRect: DOMRect | null = null;
	private editingTextEl: HTMLDivElement | null = null;
	private editingArrow: { svg: SVGSVGElement; line: SVGLineElement; start: SVGCircleElement; end: SVGCircleElement } | null = null;
	private draggingText = false;
	private dragOffset = { x: 0, y: 0 };
	private draggingArrowHandle: "start" | "end" | null = null;

	constructor(plugin: Plugin, saveFlow?: (flow: FlowDefinition) => Promise<void>) {
		this.plugin = plugin;
		this.saveFlow = saveFlow ?? null;
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
		this.overlay = new PlayerOverlay(
			() => this.stop("已退出引导"),
			() => this.promptAddHint(),
			this.editMode,
		);
		if (this.editMode) {
			this.bindToolbar();
		}
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
		if (this.editMode && (evt.key === "e" || evt.key === "E") && (evt.ctrlKey || evt.metaKey)) {
			evt.preventDefault();
			this.promptAddHint();
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
			this.editingTargetRect = target.getBoundingClientRect();
			this.overlay?.showStep(target, `${stepLabel}：点击高亮区域`, step.hint || step.hintArrow ? {
				text: step.hint,
				position: step.hintPosition ?? "bottom",
				offsetX: step.hintOffsetX ?? 0,
				offsetY: step.hintOffsetY ?? 0,
				arrow: step.hintArrow ?? true,
			} : undefined);
			this.renderAnnotations(step, this.editMode);
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

	setEditMode(enabled: boolean) {
		this.editMode = enabled;
		if (this.overlay) {
			this.overlay.setEditMode(enabled);
		}
	}

	private promptAddHint() {
		if (!this.active || !this.flow) return;
		const step = this.flow.steps[this.index];
		if (step.type !== "click") {
			new Notice("当前步骤不是可点击元素，无法添加提示。");
			return;
		}
		this.overlay?.setDimmingEnabled(false);
		const modal = new HintModal(
			this.plugin.app,
			{
				text: step.hint,
				position: step.hintPosition ?? "bottom",
				offsetX: step.hintOffsetX,
				offsetY: step.hintOffsetY,
				arrow: step.hintArrow,
			},
			({ text, position, offsetX, offsetY, arrow }) => {
				step.hint = text?.trim() || undefined;
				step.hintPosition = position;
				step.hintOffsetX = offsetX;
				step.hintOffsetY = offsetY;
				step.hintArrow = arrow;
				this.overlay?.showStep(
					this.currentTarget ?? resolveClickTarget(step) ?? document.body,
					this.tooltipTextForCurrent(),
					step.hint || step.hintArrow ? {
						text: step.hint,
						position: step.hintPosition ?? "bottom",
						offsetX: step.hintOffsetX ?? 0,
						offsetY: step.hintOffsetY ?? 0,
						arrow: step.hintArrow ?? true,
					} : undefined,
				);
				this.persistFlow();
			},
			() => {
				this.overlay?.setDimmingEnabled(true);
			},
		);
		modal.open();
	}

	private bindToolbar() {
		const buttons = this.overlay?.getToolbarButtons();
		if (!buttons) return;
		buttons.addText.onclick = () => this.createOrEditTextAnnotation();
		buttons.addArrow.onclick = () => this.createOrEditArrowAnnotation();
		buttons.save.onclick = () => this.saveAnnotations();
		buttons.next.onclick = () => {
			this.saveAnnotations();
			this.index += 1;
			this.nextStep();
		};
	}

	private createOrEditTextAnnotation() {
		if (!this.editMode || !this.currentTarget || !this.overlay) return;
		const rect = this.currentTarget.getBoundingClientRect();
		if (!this.editingTextEl) {
			const el = document.createElement("div");
			el.className = "demo-maker-annotation-text";
			el.contentEditable = "true";
			el.textContent = "提示";
			el.style.left = `${rect.right + 12 + window.scrollX}px`;
			el.style.top = `${rect.top + window.scrollY}px`;
			el.onmousedown = (e) => {
				this.draggingText = true;
				this.dragOffset = { x: e.clientX - el.offsetLeft, y: e.clientY - el.offsetTop };
				e.preventDefault();
			};
			document.addEventListener("mousemove", this.onTextDrag);
			document.addEventListener("mouseup", this.onTextDragEnd);
			this.editingTextEl = el;
			this.overlay.setTextAnnotation(el);
		}
	}

	private onTextDrag = (e: MouseEvent) => {
		if (!this.draggingText || !this.editingTextEl) return;
		this.editingTextEl.style.left = `${e.clientX - this.dragOffset.x}px`;
		this.editingTextEl.style.top = `${e.clientY - this.dragOffset.y}px`;
	};

	private onTextDragEnd = () => {
		this.draggingText = false;
	};

	private createOrEditArrowAnnotation() {
		if (!this.editMode || !this.currentTarget || !this.overlay) return;
		const rect = this.currentTarget.getBoundingClientRect();
		if (!this.editingArrow) {
			const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			svg.classList.add("demo-maker-annotation-arrow");
			svg.setAttribute("width", `${window.innerWidth}`);
			svg.setAttribute("height", `${window.innerHeight}`);
			svg.style.left = "0px";
			svg.style.top = "0px";

			const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
			line.setAttribute("stroke", "#7c5dfa");
			line.setAttribute("stroke-width", "3");

			const start = document.createElementNS("http://www.w3.org/2000/svg", "circle");
			start.setAttribute("r", "6");
			start.classList.add("demo-maker-annotation-handle");
			const end = document.createElementNS("http://www.w3.org/2000/svg", "circle");
			end.setAttribute("r", "6");
			end.classList.add("demo-maker-annotation-handle");

			const defaultX1 = rect.left + rect.width / 2 + window.scrollX;
			const defaultY1 = rect.top + window.scrollY - 20;
			const defaultX2 = rect.left + rect.width / 2 + window.scrollX;
			const defaultY2 = rect.top + window.scrollY - 80;

			line.setAttribute("x1", `${defaultX1}`);
			line.setAttribute("y1", `${defaultY1}`);
			line.setAttribute("x2", `${defaultX2}`);
			line.setAttribute("y2", `${defaultY2}`);
			start.setAttribute("cx", `${defaultX1}`);
			start.setAttribute("cy", `${defaultY1}`);
			end.setAttribute("cx", `${defaultX2}`);
			end.setAttribute("cy", `${defaultY2}`);

			start.onmousedown = (e) => this.beginArrowDrag(e, "start");
			end.onmousedown = (e) => this.beginArrowDrag(e, "end");

			svg.append(line, start, end);
			document.addEventListener("mousemove", this.onArrowDrag);
			document.addEventListener("mouseup", this.onArrowDragEnd);
			this.editingArrow = { svg, line, start, end };
			this.overlay.setArrowAnnotation(svg, line, start, end);
		}
	}

	private beginArrowDrag(e: MouseEvent, handle: "start" | "end") {
		this.draggingArrowHandle = handle;
		e.preventDefault();
	}

	private onArrowDrag = (e: MouseEvent) => {
		if (!this.draggingArrowHandle || !this.editingArrow || !this.overlay) return;
		const x = e.clientX + window.scrollX;
		const y = e.clientY + window.scrollY;
		const line = this.editingArrow.line;
		const startX = Number(line.getAttribute("x1"));
		const startY = Number(line.getAttribute("y1"));
		const endX = Number(line.getAttribute("x2"));
		const endY = Number(line.getAttribute("y2"));
		const newStartX = this.draggingArrowHandle === "start" ? x : startX;
		const newStartY = this.draggingArrowHandle === "start" ? y : startY;
		const newEndX = this.draggingArrowHandle === "end" ? x : endX;
		const newEndY = this.draggingArrowHandle === "end" ? y : endY;
		this.overlay.updateArrowLine(newStartX, newStartY, newEndX, newEndY);
	};

	private onArrowDragEnd = () => {
		this.draggingArrowHandle = null;
	};

	private renderAnnotations(step: FlowStep, editable = false) {
		if (step.type !== "click" || !this.overlay || !this.currentTarget) return;
		const rect = this.currentTarget.getBoundingClientRect();
		// text
		if (step.textAnnotation) {
			const el = document.createElement("div");
			el.className = "demo-maker-annotation-text";
			el.textContent = step.textAnnotation.content;
			el.style.left = `${rect.left + window.scrollX + step.textAnnotation.offsetX}px`;
			el.style.top = `${rect.top + window.scrollY + step.textAnnotation.offsetY}px`;
			if (editable) {
				el.onmousedown = (e) => {
					this.draggingText = true;
					this.dragOffset = { x: e.clientX - el.offsetLeft, y: e.clientY - el.offsetTop };
					e.preventDefault();
				};
				el.contentEditable = "true";
				document.addEventListener("mousemove", this.onTextDrag);
				document.addEventListener("mouseup", this.onTextDragEnd);
			} else {
				el.contentEditable = "false";
			}
			this.editingTextEl = el;
			this.overlay.setTextAnnotation(el);
		} else {
			this.overlay.setTextAnnotation(null);
			this.editingTextEl = null;
		}
		// arrow
		if (step.arrowAnnotation) {
			const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
			svg.classList.add("demo-maker-annotation-arrow");
			svg.setAttribute("width", `${window.innerWidth}`);
			svg.setAttribute("height", `${window.innerHeight}`);
			svg.style.left = "0px";
			svg.style.top = "0px";

			const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
			line.setAttribute("stroke", "#7c5dfa");
			line.setAttribute("stroke-width", "3");

			const start = document.createElementNS("http://www.w3.org/2000/svg", "circle");
			start.setAttribute("r", "6");
			start.classList.add("demo-maker-annotation-handle");
			const end = document.createElementNS("http://www.w3.org/2000/svg", "circle");
			end.setAttribute("r", "6");
			end.classList.add("demo-maker-annotation-handle");

			const absX1 = rect.left + window.scrollX + step.arrowAnnotation.x1;
			const absY1 = rect.top + window.scrollY + step.arrowAnnotation.y1;
			const absX2 = rect.left + window.scrollX + step.arrowAnnotation.x2;
			const absY2 = rect.top + window.scrollY + step.arrowAnnotation.y2;

			line.setAttribute("x1", `${absX1}`);
			line.setAttribute("y1", `${absY1}`);
			line.setAttribute("x2", `${absX2}`);
			line.setAttribute("y2", `${absY2}`);
			start.setAttribute("cx", `${absX1}`);
			start.setAttribute("cy", `${absY1}`);
			end.setAttribute("cx", `${absX2}`);
			end.setAttribute("cy", `${absY2}`);

			if (editable) {
				start.onmousedown = (e) => this.beginArrowDrag(e, "start");
				end.onmousedown = (e) => this.beginArrowDrag(e, "end");
			} else {
				start.setAttribute("visibility", "hidden");
				end.setAttribute("visibility", "hidden");
			}

			svg.append(line, start, end);
			if (editable) {
				document.addEventListener("mousemove", this.onArrowDrag);
				document.addEventListener("mouseup", this.onArrowDragEnd);
			}
			this.editingArrow = { svg, line, start, end };
			this.overlay.setArrowAnnotation(svg, line, start, end);
		} else {
			this.overlay.setArrowAnnotation(null);
			this.editingArrow = null;
		}
	}

	private saveAnnotations() {
		if (!this.editMode || !this.flow || !this.currentTarget) return;
		const step = this.flow.steps[this.index];
		if (step.type !== "click") return;
		const rect = this.currentTarget.getBoundingClientRect();
		// text
		if (this.editingTextEl && this.editingTextEl.textContent?.trim()) {
			const offsetX = this.editingTextEl.offsetLeft - (rect.left + window.scrollX);
			const offsetY = this.editingTextEl.offsetTop - (rect.top + window.scrollY);
			step.textAnnotation = {
				content: this.editingTextEl.textContent.trim(),
				offsetX,
				offsetY,
			};
		} else {
			step.textAnnotation = undefined;
		}
		// arrow
		if (this.editingArrow) {
			const line = this.editingArrow.line;
			const x1 = Number(line.getAttribute("x1")) - (rect.left + window.scrollX);
			const y1 = Number(line.getAttribute("y1")) - (rect.top + window.scrollY);
			const x2 = Number(line.getAttribute("x2")) - (rect.left + window.scrollX);
			const y2 = Number(line.getAttribute("y2")) - (rect.top + window.scrollY);
			step.arrowAnnotation = { x1, y1, x2, y2 };
		} else {
			step.arrowAnnotation = undefined;
		}
		this.persistFlow();
		new Notice("已保存当前步骤的提示/箭头");
	}

	private tooltipTextForCurrent() {
		if (!this.flow) return "";
		return `步骤 ${this.index + 1}/${this.flow.steps.length}：点击高亮区域`;
	}

	private async persistFlow() {
		if (!this.flow || !this.saveFlow) return;
		await this.saveFlow(this.flow);
	}
}
