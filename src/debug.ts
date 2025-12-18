import { FlowDefinition } from "./types";

export interface SelectorCheckResult {
	stepIndex: number;
	stepId: string;
	candidate: string;
	count: number;
}

export const checkSelectors = (flow: FlowDefinition): SelectorCheckResult[] => {
	const results: SelectorCheckResult[] = [];
	flow.steps.forEach((step, idx) => {
		if (step.type !== "click") return;
		for (const candidate of step.selector.candidates) {
			const count = document.querySelectorAll(candidate).length;
			results.push({
				stepIndex: idx + 1,
				stepId: step.id,
				candidate,
				count,
			});
		}
	});
	return results;
};
