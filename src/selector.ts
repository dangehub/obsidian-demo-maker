import { ClickStep, SelectorSet } from "./types";

const escapeValue = (value: string) => {
	if (typeof CSS !== "undefined" && (CSS as any).escape) {
		return (CSS as any).escape(value);
	}
	return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
};

const selectorFromAttribute = (name: string, value: string) => `[${name}="${escapeValue(value)}"]`;

const nthOfType = (el: Element) => {
	const tag = el.tagName;
	const siblings = el.parentElement?.children;
	if (!siblings) return 1;
	let count = 0;
	for (const sibling of Array.from(siblings)) {
		if (sibling.tagName === tag) {
			count++;
		}
		if (sibling === el) {
			return count;
		}
	}
	return 1;
};

const buildStructuralSelector = (el: HTMLElement) => {
	const parts: string[] = [];
	let current: HTMLElement | null = el;
	let depth = 0;
	while (current && depth < 4 && current !== document.body) {
		const tag = current.tagName.toLowerCase();
		if (current.id) {
			parts.unshift(`${tag}#${escapeValue(current.id)}`);
			break;
		}

		if (current.classList.length > 0 && current.classList.length <= 3) {
			const cls = Array.from(current.classList)
				.slice(0, 2)
				.map((c) => `.${escapeValue(c)}`)
				.join("");
			parts.unshift(`${tag}${cls}`);
		} else {
			parts.unshift(`${tag}:nth-of-type(${nthOfType(current)})`);
		}

		current = current.parentElement;
		depth++;
	}

	return parts.join(" > ");
};

const gatherAttributeSelectors = (el: HTMLElement) => {
	const selectors: string[] = [];
	for (const attr of Array.from(el.attributes)) {
		if (attr.name.startsWith("data-") && attr.value) {
			selectors.push(selectorFromAttribute(attr.name, attr.value));
		}
		if (attr.name === "aria-label" && attr.value) {
			selectors.push(selectorFromAttribute(attr.name, attr.value));
		}
		if ((attr.name === "title" || attr.name === "aria-labelledby") && attr.value) {
			selectors.push(selectorFromAttribute(attr.name, attr.value));
		}
	}
	if (el.id) {
		selectors.unshift(`#${escapeValue(el.id)}`);
	}
	return selectors;
};

const gatherClassSelectors = (el: HTMLElement) => {
	if (!el.classList.length || el.classList.length > 3) return [];
	const classSelector = Array.from(el.classList)
		.slice(0, 2)
		.map((c) => `.${escapeValue(c)}`)
		.join("");
	if (classSelector) {
		return [`${el.tagName.toLowerCase()}${classSelector}`];
	}
	return [];
};

const uniqueList = (items: string[]) => {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const item of items) {
		if (!seen.has(item)) {
			seen.add(item);
			result.push(item);
		}
	}
	return result;
};

const pickPrimary = (candidates: string[]) => {
	for (const candidate of candidates) {
		const matches = document.querySelectorAll(candidate);
		if (matches.length === 1) {
			return candidate;
		}
	}
	return candidates[0] ?? "body";
};

export const buildSelectorSet = (el: HTMLElement): SelectorSet => {
	const candidates: string[] = [];
	candidates.push(...gatherAttributeSelectors(el));
	candidates.push(...gatherClassSelectors(el));
	candidates.push(buildStructuralSelector(el));

	const deduped = uniqueList(candidates.filter((c) => !!c));
	const primary = pickPrimary(deduped);
	const fallbacks = deduped.filter((c) => c !== primary);
	return {
		primary,
		candidates: [primary, ...fallbacks],
	};
};

const normalizeText = (text: string) => text.trim().replace(/\s+/g, " ").toLowerCase();

export const resolveSelector = (selectorSet: SelectorSet, textHint?: string): HTMLElement | null => {
	const normalizedHint = textHint ? normalizeText(textHint) : null;
	for (const candidate of selectorSet.candidates) {
		const matches = Array.from(document.querySelectorAll<HTMLElement>(candidate));
		if (!matches.length) continue;
		if (normalizedHint) {
			const filtered = matches.filter((el) => normalizeText(el.innerText || el.getAttribute("aria-label") || "") === normalizedHint ||
				normalizeText(el.innerText || el.getAttribute("aria-label") || "").includes(normalizedHint));
			if (filtered.length === 1) return filtered[0];
			if (filtered.length > 1) return filtered[0];
		}
		if (matches.length === 1) return matches[0];
	}
	return null;
};

export const resolveClickTarget = (step: ClickStep): HTMLElement | null => {
	return resolveSelector(step.selector, step.textHint);
};
