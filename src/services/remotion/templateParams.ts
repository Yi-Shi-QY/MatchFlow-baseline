import { TEMPLATES } from "./templates";

export type AnimationType =
  | "stats"
  | "tactical"
  | "odds"
  | "comparison"
  | "none"
  | string;

export interface TemplateDeclaration {
  animationType: string;
  templateId: string;
  requiredParams: string[];
  schema: any;
  example: any;
}

export interface NormalizedAnimationPayload {
  type: string;
  templateId: string;
  title: string;
  narration: string;
  params: any;
  data: any;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  payload: NormalizedAnimationPayload;
}

const ANIMATION_TO_TEMPLATE: Record<string, string> = {
  stats: "stats-comparison",
  comparison: "stats-comparison",
  tactical: "tactical-board",
  odds: "odds-card",
};

const DOMAIN_ANIMATION_TO_TEMPLATE: Record<string, Record<string, string>> = {
  fengshui: {
    stats: "fengshui-qi-radar",
    comparison: "fengshui-qi-radar",
    tactical: "fengshui-compass-grid",
    odds: "fengshui-cycle-board",
  },
};

export interface TemplateResolveOptions {
  domainId?: string | null;
  templateId?: string | null;
}

function normalizeDomainId(domainId?: string | null): string | null {
  if (typeof domainId !== "string") return null;
  const normalized = domainId.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export function getTemplateIdByAnimationType(
  animationType?: string,
  options: TemplateResolveOptions = {},
): string {
  const preferredTemplateId =
    typeof options.templateId === "string" ? options.templateId.trim() : "";
  if (preferredTemplateId && TEMPLATES[preferredTemplateId]) {
    return preferredTemplateId;
  }

  const normalizedType =
    typeof animationType === "string" && animationType.trim().length > 0
      ? animationType.trim()
      : "stats";

  const domainId = normalizeDomainId(options.domainId);
  if (domainId && DOMAIN_ANIMATION_TO_TEMPLATE[domainId]) {
    const domainTemplateId = DOMAIN_ANIMATION_TO_TEMPLATE[domainId][normalizedType];
    if (domainTemplateId && TEMPLATES[domainTemplateId]) {
      return domainTemplateId;
    }
  }

  return ANIMATION_TO_TEMPLATE[normalizedType] || "stats-comparison";
}

interface AnimationTypeListOptions {
  domainId?: string | null;
  animationTemplateIds?: string[] | null;
  includeNone?: boolean;
}

export function listAnimationTypesForDomain(
  options: AnimationTypeListOptions = {},
): string[] {
  const filterTemplateIds = new Set(
    Array.isArray(options.animationTemplateIds)
      ? options.animationTemplateIds
          .map((id) => (typeof id === "string" ? id.trim() : ""))
          .filter((id) => id.length > 0)
      : [],
  );

  const isTemplateAllowed = (templateId: string): boolean => {
    if (!(templateId in TEMPLATES)) return false;
    if (filterTemplateIds.size === 0) return true;
    return filterTemplateIds.has(templateId);
  };

  const animationTypes = new Set<string>();

  const domainId = normalizeDomainId(options.domainId);
  if (domainId && DOMAIN_ANIMATION_TO_TEMPLATE[domainId]) {
    Object.entries(DOMAIN_ANIMATION_TO_TEMPLATE[domainId]).forEach(([type, templateId]) => {
      if (isTemplateAllowed(templateId)) animationTypes.add(type);
    });
  }

  Object.entries(ANIMATION_TO_TEMPLATE).forEach(([type, templateId]) => {
    if (isTemplateAllowed(templateId)) animationTypes.add(type);
  });

  if (options.includeNone !== false) {
    animationTypes.add("none");
  }

  return Array.from(animationTypes);
}

export function getTemplateDeclaration(
  animationType: AnimationType,
  options: TemplateResolveOptions = {},
): TemplateDeclaration {
  const templateId = getTemplateIdByAnimationType(animationType, options);
  const template = TEMPLATES[templateId];
  return {
    animationType: String(animationType || "stats"),
    templateId,
    requiredParams: template.requiredParams || [],
    schema: template.schema,
    example: template.example,
  };
}

function requiredPathValueExists(input: any, path: string): boolean {
  const segments = path.split(".");
  let cur = input;
  for (const key of segments) {
    if (cur == null || !(key in cur)) return false;
    cur = cur[key];
  }
  return cur !== undefined && cur !== null && !(typeof cur === "string" && cur.trim() === "");
}

export function validateAndNormalizeAnimationPayload(
  rawAnimation: any,
  expectedType?: string,
  options: TemplateResolveOptions = {},
): ValidationResult {
  const incomingType = expectedType || rawAnimation?.type || "stats";
  const preferredTemplateId =
    typeof rawAnimation?.templateId === "string" && rawAnimation.templateId.trim().length > 0
      ? rawAnimation.templateId.trim()
      : options.templateId;
  const declaration = getTemplateDeclaration(incomingType, {
    ...options,
    templateId: preferredTemplateId,
  });
  const template = TEMPLATES[declaration.templateId];
  const rawParams = rawAnimation?.params ?? rawAnimation?.data ?? {};
  const normalizedParams = template.fillParams(rawParams);

  const payload: NormalizedAnimationPayload = {
    type: declaration.animationType,
    templateId: declaration.templateId,
    title: typeof rawAnimation?.title === "string" ? rawAnimation.title : "",
    narration: typeof rawAnimation?.narration === "string" ? rawAnimation.narration : "",
    params: normalizedParams,
    data: normalizedParams,
  };

  const errors: string[] = [];
  for (const path of declaration.requiredParams) {
    if (!requiredPathValueExists(rawParams, path)) {
      errors.push(`missing required param: ${path}`);
    }
  }

  if (payload.templateId === "stats-comparison") {
    if (!Number.isFinite(payload.params.homeValue)) errors.push("homeValue must be a finite number");
    if (!Number.isFinite(payload.params.awayValue)) errors.push("awayValue must be a finite number");
  }
  if (payload.templateId === "odds-card") {
    if (!Number.isFinite(payload.params?.had?.h)) errors.push("had.h must be a finite number");
    if (!Number.isFinite(payload.params?.had?.d)) errors.push("had.d must be a finite number");
    if (!Number.isFinite(payload.params?.had?.a)) errors.push("had.a must be a finite number");
  }
  if (payload.templateId === "fengshui-qi-radar") {
    if (!Number.isFinite(payload.params?.qiFlowScore)) errors.push("qiFlowScore must be a finite number");
    if (!Number.isFinite(payload.params?.harmonyScore)) errors.push("harmonyScore must be a finite number");
    if (!Number.isFinite(payload.params?.pressureScore)) errors.push("pressureScore must be a finite number");
  }
  if (payload.templateId === "fengshui-cycle-board") {
    if (!Number.isFinite(payload.params?.yearlyInfluence)) {
      errors.push("yearlyInfluence must be a finite number");
    }
    if (!Number.isFinite(payload.params?.monthlyInfluence)) {
      errors.push("monthlyInfluence must be a finite number");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    payload,
  };
}

export function buildAnimationBlock(payload: NormalizedAnimationPayload): string {
  const json = JSON.stringify(payload, null, 2);
  return `<animation>\n${json}\n</animation>`;
}

export function buildFallbackAnimationPayload(
  animationType: string,
  title: string,
  homeName: string,
  awayName: string,
  options: TemplateResolveOptions = {},
): NormalizedAnimationPayload {
  const declaration = getTemplateDeclaration(animationType, options);
  const template = TEMPLATES[declaration.templateId];

  let fallbackParams: any = template.example;
  if (declaration.templateId === "stats-comparison") {
    fallbackParams = {
      ...template.example,
      homeLabel: homeName || "Home Team",
      awayLabel: awayName || "Away Team",
      metric: "Comparison",
      homeValue: 0,
      awayValue: 0,
    };
  }
  if (declaration.templateId === "odds-card") {
    fallbackParams = {
      ...template.example,
      homeLabel: homeName || "HOME",
      awayLabel: awayName || "AWAY",
    };
  }
  if (declaration.templateId === "fengshui-qi-radar") {
    fallbackParams = {
      ...template.example,
      subjectLabel: homeName || "Subject",
      referenceLabel: awayName || "Reference",
      metric: "Qi Structure",
      qiFlowScore: 0,
      harmonyScore: 0,
      pressureScore: 0,
    };
  }
  if (declaration.templateId === "fengshui-compass-grid") {
    fallbackParams = {
      ...template.example,
      direction: "South",
      activeSector: "Center Axis",
      supportSector: "Support Sector",
      cautionSector: "Caution Sector",
      note: "",
    };
  }
  if (declaration.templateId === "fengshui-cycle-board") {
    fallbackParams = {
      ...template.example,
      yearlyInfluence: 0,
      monthlyInfluence: 0,
      favorableWindow: "Favorable window",
      cautionWindow: "Caution window",
    };
  }

  const normalizedParams = template.fillParams(fallbackParams);
  return {
    type: declaration.animationType,
    templateId: declaration.templateId,
    title: title || "Data Visualization",
    narration: "",
    params: normalizedParams,
    data: normalizedParams,
  };
}

export function buildTemplatePromptSpec(
  animationType: string,
  title: string,
  homeName: string,
  awayName: string,
  options: TemplateResolveOptions = {},
): string {
  const declaration = getTemplateDeclaration(animationType, options);
  const template = TEMPLATES[declaration.templateId];

  const prefillExample = (() => {
    if (declaration.templateId === "stats-comparison") {
      return {
        ...template.example,
        homeLabel: homeName || "Home Team",
        awayLabel: awayName || "Away Team",
      };
    }
    if (declaration.templateId === "odds-card") {
      return {
        ...template.example,
        homeLabel: homeName || "HOME",
        awayLabel: awayName || "AWAY",
      };
    }
    if (declaration.templateId === "fengshui-qi-radar") {
      return {
        ...template.example,
        subjectLabel: homeName || "Subject",
        referenceLabel: awayName || "Reference",
      };
    }
    return template.example;
  })();

  return [
    `Animation Type: ${animationType}`,
    `Template ID: ${declaration.templateId}`,
    `Template Name: ${template.name}`,
    `Required Params: ${declaration.requiredParams.join(", ") || "none"}`,
    "Parameter Schema:",
    JSON.stringify(declaration.schema, null, 2),
    "Example Params:",
    JSON.stringify(prefillExample, null, 2),
    `Segment Title: ${title}`,
  ].join("\n");
}
