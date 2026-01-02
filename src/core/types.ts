/**
 * Demo Maker - 类型定义
 */

// ============================================================
// 步骤类型
// ============================================================

/**
 * 步骤类型枚举
 * - click: 点击某个元素，自动检测点击完成
 * - input: 输入/编辑操作，需要手动点击"下一步"
 * - select: 下拉选单选择，自动检测选择完成
 * - wait: 等待一段时间后自动进入下一步
 * - message: 纯提示信息，需要手动点击"继续"
 */
export type StepType = 'click' | 'input' | 'select' | 'wait' | 'message';

/**
 * 触发类型
 * - auto: 自动触发（点击高亮区域、倒计时结束）
 * - manual: 手动触发（点击"下一步"按钮）
 */
export type TriggerType = 'auto' | 'manual';

// ============================================================
// 元素定位器
// ============================================================

/**
 * 上下文限定条件
 */
export interface LocatorContext {
	/** 是否在 Modal 弹窗中 */
	modal?: boolean;
	/** Modal 的 CSS 类名 */
	modalClass?: string;
	/** 设置页的标签名 */
	settingsTab?: string;
	/** 侧边栏类型 */
	sidebarType?: 'left' | 'right';
}

/**
 * 元素定位器
 * 多策略定位，优先使用语义化属性
 */
export interface Locator {
	// === 语义定位（推荐，最稳定）===
	/** aria-label 属性值 */
	ariaLabel?: string;
	/** data-type 属性值 */
	dataType?: string;
	/** 设置项 ID */
	settingId?: string;
	/** 设置项名称（用于定位设置页控件）*/
	settingName?: string;
	/** 控件类型（与 settingName 配合使用）*/
	controlType?: 'select' | 'toggle' | 'button' | 'input' | 'slider';
	/** 输入框提示文字 */
	placeholder?: string;
	/** 元素类型 (如 input 的 type) */
	elementType?: string;

	// === 文本定位 ===
	/** 元素内的精确文本 */
	textContent?: string;
	/** 元素内包含的文本（模糊匹配）*/
	textContains?: string;

	// === 结构定位（降级方案）===
	/** CSS 选择器 */
	cssSelector?: string;

	// === 上下文限定 ===
	/** 上下文条件 */
	context?: LocatorContext;

	// === 人工备注 ===
	/** 人类可读的描述，用于调试和降级提示 */
	humanDescription?: string;
}

// ============================================================
// 标注
// ============================================================

/** 标注锚点类型 */
export type AnchorType = 'target' | 'screen';

/** 标注位置 */
export type Placement = 'top' | 'bottom' | 'left' | 'right' | 'center';

/** 标注主题 */
export type AnnotationTheme = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

/**
 * 文字标注
 */
export interface TextAnnotation {
	id: string;
	type: 'text';
	/** Markdown 格式的提示文字 */
	content: string;
	position: {
		/** 相对于目标元素还是屏幕 */
		anchor: AnchorType;
		/** 位置 */
		placement: Placement;
		/** X 偏移 */
		offsetX?: number;
		/** Y 偏移 */
		offsetY?: number;
	};
	style?: {
		maxWidth?: number;
		theme?: AnnotationTheme;
	};
}

/**
 * 箭头标注
 */
export interface ArrowAnnotation {
	id: string;
	type: 'arrow';
	from: { x: number; y: number; anchor: AnchorType };
	to: { x: number; y: number; anchor: AnchorType };
	style?: {
		color?: string;
		curved?: boolean;
	};
}

/** 标注联合类型 */
export type Annotation = TextAnnotation | ArrowAnnotation;

// ============================================================
// 步骤定义
// ============================================================

/**
 * 步骤基类
 */
export interface BaseStep {
	id: string;
	type: StepType;
	/** 标注列表 */
	annotations?: Annotation[];
}

/**
 * 点击步骤
 */
export interface ClickStep extends BaseStep {
	type: 'click';
	/** 元素定位器 */
	locator: Locator;
}

/**
 * 输入步骤（手动确认）
 */
export interface InputStep extends BaseStep {
	type: 'input';
	/** 元素定位器 */
	locator: Locator;
}

/**
 * 选择步骤（下拉选单）
 */
export interface SelectStep extends BaseStep {
	type: 'select';
	/** 元素定位器 */
	locator: Locator;
	/** 期望选择的 option 文本值 */
	expectedValue: string;
}

/**
 * 等待步骤
 */
export interface WaitStep extends BaseStep {
	type: 'wait';
	/** 等待时长（毫秒）*/
	durationMs: number;
}

/**
 * 消息步骤（纯显示文本）
 */
export interface MessageStep extends BaseStep {
	type: 'message';
	/** 可选的元素定位器 */
	locator?: Locator;
}
export type FlowStep = ClickStep | InputStep | SelectStep | WaitStep | MessageStep;

// ============================================================
// 流程定义
// ============================================================

/**
 * 流程元数据
 */
export interface FlowMetadata {
	/** 流程 ID */
	id: string;
	/** 流程名称 */
	name: string;
	/** 流程描述 */
	description?: string;
	/** 作者 */
	author?: string;
	/** 创建时间 */
	createdAt: string;
	/** 更新时间 */
	updatedAt: string;
	/** 版本 */
	version: string;
}

/**
 * 流程定义
 */
export interface FlowDefinition extends FlowMetadata {
	/** 步骤列表 */
	steps: FlowStep[];
}

// ============================================================
// 插件数据
// ============================================================

/**
 * 插件设置
 */
export interface DemoMakerSettings {
	/** 遮罩透明度 (0-1) */
	overlayOpacity: number;
	/** 高亮边框颜色 */
	highlightColor: string;
}

/**
 * 插件数据
 */
export interface DemoMakerData {
	settings: DemoMakerSettings;
	/** 最近打开的流程 ID 列表 */
	recentFlows: string[];
}

/**
 * 默认设置
 */
export const DEFAULT_SETTINGS: DemoMakerSettings = {
	overlayOpacity: 0.6,
	highlightColor: '#ffd166',
};

/**
 * 默认插件数据
 */
export const DEFAULT_DATA: DemoMakerData = {
	settings: DEFAULT_SETTINGS,
	recentFlows: [],
};
