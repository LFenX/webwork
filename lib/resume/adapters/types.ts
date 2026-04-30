import type { ResumeJson } from "../types";
import type { ThemeFieldProfile } from "../theme-field-profiles";

/** 模板展示分类：仅控制展示分组，与 locale 解耦 */
export type TemplateCategory = "zh" | "en";

/** 简历外观设置 */
export type ResumeAppearance = "system" | "light" | "dark";

/** Locale 标题支持等级：Work / Education 等标题是否能随语言自动变化 */
export type LocaleTitleSupport = "changeLanguage" | "metaLocale" | "none";

/**
 * 用户自定义输出标题支持等级：用户自定义标题（如 Work → "实习与项目经历"）是否能影响最终 HTML
 * - metaHeadings: 通过 meta.theme.headings 注入
 * - htmlPatch: 渲染后由 adapter 做受控 HTML 补丁（仅限已知主题）
 * - none: 无法影响输出标题
 */
export type CustomOutputLabelSupport = "metaHeadings" | "htmlPatch" | "none";

/** Section 顺序支持等级 */
export type SectionOrderSupport = "native" | "metaSectionOrder" | "none";

/** 明暗模式支持等级 */
export type AppearanceSupport = "nativeDark" | "metaTheme" | "wrapperFallback" | "none";

/** meta.theme 整体支持度 */
export type MetaThemeSupport = "full" | "partial" | "none";

/** PDF 支持等级 */
export type PdfSupport = "native" | "headlessCompatible" | "none";

/** 并发隔离模式 */
export type ThemeIsolationMode = "mutex" | "worker" | "none";

/** HTML 安全清洗级别 */
export type SanitizeLevel = "standard" | "minimal" | "none";

/** 模板能力声明（系统内置，管理员只读） */
export interface ThemeCapabilities {
  /** Locale 标题支持：主题是否能自动切换标题语言（如 changeLanguage） */
  localeTitleSupport: LocaleTitleSupport;

  /** 用户自定义输出标题支持：用户自定义标题是否能写入最终 HTML */
  customOutputLabelSupport: CustomOutputLabelSupport;

  /** Section 顺序支持 */
  sectionOrderSupport: SectionOrderSupport;

  /** 明暗模式支持 */
  appearanceSupport: AppearanceSupport;

  /** meta.theme 整体支持度 */
  metaThemeSupport: MetaThemeSupport;

  /** PDF 支持 */
  pdfSupport: PdfSupport;

  /** 是否暴露 changeLanguage API */
  supportsChangeLanguage: boolean;

  /** 主题内置支持的 locale 列表 */
  builtInLocales: string[];

  /** 是否原生支持 dark mode */
  supportsDarkMode: boolean;

  /** 主题实际会渲染的 section 列表 */
  builtInSections: string[];

  /**
   * Locale 映射表
   * 键：用户选择的 BCP-47 标识，如 "zh-CN"
   * 值：主题内置 locale 标识，如 "zh"
   */
  localeMap: Record<string, string>;
}

/** 字段映射定义 */
export interface FieldLabelMap {
  /** section 级：work → 工作经历 */
  sections?: Record<string, string>;
  /** 字段级：work[].position → 职位 */
  fields?: Record<string, string>;
  /** 界面级：addWork → 添加工作经历 */
  ui?: Record<string, string>;
}

/** 模板默认配置（管理员可覆盖） */
export interface ThemeDefaultConfig {
  locale: string;
  appearance: ResumeAppearance;
  sectionOrder: string[];
  fieldLabelMap: FieldLabelMap;
  metaTheme: Record<string, string>;
}

/** 运行时合并后的有效配置（内存对象） */
export interface EffectiveResumeConfig {
  /** 经 localeMap 映射后的主题 locale（用于实际渲染） */
  locale: string;
  /** 用户原始选择的 locale（用于 configHash，确保用户切换不同映射源时触发重建） */
  originalLocale: string;
  /** 外观设置（保留 system 原始值） */
  appearance: ResumeAppearance;
  /** section 展示顺序 */
  sectionOrder: string[];
  /** 用户选择隐藏的 section */
  hiddenSections: string[];
  /** 字段映射 */
  fieldLabelMap: FieldLabelMap;
  /** 主题颜色覆盖 */
  metaTheme: Record<string, string>;
}

/** buildRenderInput 入参 */
export interface BuildRenderInputArgs {
  /** 用户原始简历数据（完整，含所有 section） */
  resumeJson: ResumeJson;
  /** 运行时合并后的有效配置 */
  effectiveConfig: EffectiveResumeConfig;
  /** 当前模板适配器 */
  adapter: ResumeThemeAdapter;
}

/** render 入参 */
export interface RenderArgs {
  /** 经 buildRenderInput 处理后的临时简历数据（供主题 render 使用） */
  resumeJson: ResumeJson;
  /** 运行时合并后的有效配置 */
  effectiveConfig: EffectiveResumeConfig;
  /** 当前模板适配器 */
  adapter: ResumeThemeAdapter;
}

/**
 * ResumeThemeAdapter：模板适配器完整描述
 *
 * 每个模板对应一份 adapter，由"系统内置 + 管理员覆盖"合并而成。
 * 所有模板差异必须收敛到此接口，禁止在渲染器、编辑器中写模板特判。
 */
export interface ResumeThemeAdapter {
  /** 模板标识（slug），如 "stackoverflow" */
  templateId: string;
  /** 展示名称 */
  templateName: string;
  /** npm 包名 */
  pkg: string;

  /** 展示分类 */
  category: TemplateCategory;
  /** 同分类内排序（越小越靠前） */
  sortOrder: number;
  /** 业务级启用状态（对用户是否可见） */
  enabled: boolean;

  /** 能力声明（系统内置，管理员只读） */
  capabilities: ThemeCapabilities;

  /** 默认配置（管理员可覆盖） */
  defaults: ThemeDefaultConfig;

  /** 字段能力（沿用已有 field profile） */
  fieldProfile: ThemeFieldProfile;

  /** 并发安全隔离模式 */
  requiresIsolation: ThemeIsolationMode;

  /** HTML 安全清洗级别 */
  sanitizeLevel: SanitizeLevel;

  /**
   * 构建渲染输入
   * 将用户原始数据 + 有效配置 转换为供主题 render 使用的临时 ResumeJson。
   * 此函数必须深拷贝 resumeJson，不得修改原始数据。
   */
  buildRenderInput(args: BuildRenderInputArgs): ResumeJson;

  /**
   * 渲染 HTML
   * 接收处理后的 resumeJson，输出原始 HTML 字符串。
   * 默认实现应获取 themeLock、调用主题 render、释放锁。
   */
  render(args: RenderArgs): Promise<string>;

  /**
   * 可选：HTML 后处理补丁
   * 仅在 capabilities.customOutputLabelSupport === "htmlPatch" 时由系统调用。
   * 用于对已知主题做受控文本替换，不开放给通用第三方主题。
   */
  patchHtml?(html: string, effectiveConfig: EffectiveResumeConfig): string;
}
