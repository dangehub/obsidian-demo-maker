export type DemoStepType = "click" | "wait";

export interface SelectorSet {
	primary: string;
	candidates: string[];
}

export interface BaseStep {
	id: string;
	type: DemoStepType;
	note?: string;
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
