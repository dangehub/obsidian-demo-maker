export type DemoStepType = "click" | "wait";

export interface SelectorSet {
	primary: string;
	candidates: string[];
}

export interface TextAnnotation {
	content: string;
	offsetX: number;
	offsetY: number;
}

export interface ArrowAnnotation {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
}

export interface BaseStep {
	id: string;
	type: DemoStepType;
	note?: string;
	hint?: string;
	hintPosition?: "top" | "bottom" | "left" | "right";
	hintArrow?: boolean;
	hintOffsetX?: number;
	hintOffsetY?: number;
	textAnnotation?: TextAnnotation;
	arrowAnnotation?: ArrowAnnotation;
}

export interface ClickStep extends BaseStep {
	type: "click";
	selector: SelectorSet;
	textHint?: string;
}

export interface WaitStep extends BaseStep {
	type: "wait";
	durationMs: number;
}

export type FlowStep = ClickStep | WaitStep;

export interface FlowDefinition {
	id: string;
	name: string;
	createdAt: number;
	description?: string;
	steps: FlowStep[];
}

export interface DemoMakerData {
	flows: FlowDefinition[];
	lastRecordedId?: string;
}
