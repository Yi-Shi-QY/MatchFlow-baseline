import { TEMPLATES } from './templates';

export type AnimationType =
  | 'stats'
  | 'tactical'
  | 'odds'
  | 'comparison'
  | 'basketball_metrics'
  | 'basketball_matchup'
  | 'basketball_lines'
  | 'none'
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
  data: any; // Backward-compatible alias for older consumers
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  payload: NormalizedAnimationPayload;
}

const ANIMATION_TO_TEMPLATE: Record<string, string> = {
  stats: 'stats-comparison',
  comparison: 'stats-comparison',
  tactical: 'tactical-board',
  odds: 'odds-card',
  basketball_metrics: 'basketball-metrics-radar',
  basketball_matchup: 'basketball-matchup-board',
  basketball_lines: 'basketball-lines-card',
};

export function getTemplateIdByAnimationType(animationType?: string): string {
  if (!animationType) return 'stats-comparison';
  return ANIMATION_TO_TEMPLATE[animationType] || 'stats-comparison';
}

export function getTemplateDeclaration(
  animationType: AnimationType,
): TemplateDeclaration {
  const templateId = getTemplateIdByAnimationType(animationType);
  const template = TEMPLATES[templateId];
  return {
    animationType: String(animationType || 'stats'),
    templateId,
    requiredParams: template.requiredParams || [],
    schema: template.schema,
    example: template.example,
  };
}

function requiredPathValueExists(input: any, path: string): boolean {
  const segments = path.split('.');
  let cur = input;
  for (const key of segments) {
    if (cur == null || !(key in cur)) return false;
    cur = cur[key];
  }
  return cur !== undefined && cur !== null && !(typeof cur === 'string' && cur.trim() === '');
}

export function validateAndNormalizeAnimationPayload(
  rawAnimation: any,
  expectedType?: string,
): ValidationResult {
  const incomingType = expectedType || rawAnimation?.type || 'stats';
  const declaration = getTemplateDeclaration(incomingType);
  const template = TEMPLATES[declaration.templateId];
  const rawParams = rawAnimation?.params ?? rawAnimation?.data ?? {};
  const normalizedParams = template.fillParams(rawParams);

  const payload: NormalizedAnimationPayload = {
    type: declaration.animationType,
    templateId: declaration.templateId,
    title: typeof rawAnimation?.title === 'string' ? rawAnimation.title : '',
    narration: typeof rawAnimation?.narration === 'string' ? rawAnimation.narration : '',
    params: normalizedParams,
    data: normalizedParams,
  };

  const errors: string[] = [];
  for (const path of declaration.requiredParams) {
    if (!requiredPathValueExists(rawParams, path)) {
      errors.push(`missing required param: ${path}`);
    }
  }

  // Type-specific safety checks
  if (payload.templateId === 'stats-comparison') {
    if (!Number.isFinite(payload.params.homeValue)) errors.push('homeValue must be a finite number');
    if (!Number.isFinite(payload.params.awayValue)) errors.push('awayValue must be a finite number');
  }
  if (payload.templateId === 'odds-card') {
    if (!Number.isFinite(payload.params?.had?.h)) errors.push('had.h must be a finite number');
    if (!Number.isFinite(payload.params?.had?.d)) errors.push('had.d must be a finite number');
    if (!Number.isFinite(payload.params?.had?.a)) errors.push('had.a must be a finite number');
  }
  if (payload.templateId === 'basketball-metrics-radar') {
    if (!Number.isFinite(payload.params?.pace?.home)) errors.push('pace.home must be a finite number');
    if (!Number.isFinite(payload.params?.pace?.away)) errors.push('pace.away must be a finite number');
    if (!Number.isFinite(payload.params?.offensiveRating?.home)) {
      errors.push('offensiveRating.home must be a finite number');
    }
    if (!Number.isFinite(payload.params?.offensiveRating?.away)) {
      errors.push('offensiveRating.away must be a finite number');
    }
    if (!Number.isFinite(payload.params?.defensiveRating?.home)) {
      errors.push('defensiveRating.home must be a finite number');
    }
    if (!Number.isFinite(payload.params?.defensiveRating?.away)) {
      errors.push('defensiveRating.away must be a finite number');
    }
  }
  if (payload.templateId === 'basketball-lines-card') {
    if (!Number.isFinite(payload.params?.moneyline?.home)) {
      errors.push('moneyline.home must be a finite number');
    }
    if (!Number.isFinite(payload.params?.moneyline?.away)) {
      errors.push('moneyline.away must be a finite number');
    }
    if (!Number.isFinite(payload.params?.spread?.line)) {
      errors.push('spread.line must be a finite number');
    }
    if (!Number.isFinite(payload.params?.total?.points)) {
      errors.push('total.points must be a finite number');
    }
  }
  if (payload.templateId === 'basketball-matchup-board') {
    if (typeof payload.params?.focusArea !== 'string' || !payload.params.focusArea.trim()) {
      errors.push('focusArea must be a non-empty string');
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
): NormalizedAnimationPayload {
  const declaration = getTemplateDeclaration(animationType);
  const template = TEMPLATES[declaration.templateId];

  let fallbackParams: any = template.example;
  if (declaration.templateId === 'stats-comparison') {
    fallbackParams = {
      ...template.example,
      homeLabel: homeName || 'Home Team',
      awayLabel: awayName || 'Away Team',
      metric: 'Comparison',
      homeValue: 0,
      awayValue: 0,
    };
  }
  if (declaration.templateId === 'odds-card') {
    fallbackParams = {
      ...template.example,
      homeLabel: homeName || 'HOME',
      awayLabel: awayName || 'AWAY',
    };
  }
  if (declaration.templateId === 'basketball-metrics-radar') {
    fallbackParams = {
      ...template.example,
      homeLabel: homeName || 'Home',
      awayLabel: awayName || 'Away',
    };
  }
  if (declaration.templateId === 'basketball-lines-card') {
    fallbackParams = {
      ...template.example,
      homeLabel: homeName || 'Home',
      awayLabel: awayName || 'Away',
    };
  }

  const normalizedParams = template.fillParams(fallbackParams);
  return {
    type: declaration.animationType,
    templateId: declaration.templateId,
    title: title || 'Data Visualization',
    narration: '',
    params: normalizedParams,
    data: normalizedParams,
  };
}

export function buildTemplatePromptSpec(
  animationType: string,
  title: string,
  homeName: string,
  awayName: string,
): string {
  const declaration = getTemplateDeclaration(animationType);
  const template = TEMPLATES[declaration.templateId];

  const prefillExample = (() => {
    if (declaration.templateId === 'stats-comparison') {
      return {
        ...template.example,
        homeLabel: homeName || 'Home Team',
        awayLabel: awayName || 'Away Team',
      };
    }
    if (declaration.templateId === 'odds-card') {
      return {
        ...template.example,
        homeLabel: homeName || 'HOME',
        awayLabel: awayName || 'AWAY',
      };
    }
    if (declaration.templateId === 'basketball-metrics-radar') {
      return {
        ...template.example,
        homeLabel: homeName || 'Home',
        awayLabel: awayName || 'Away',
      };
    }
    if (declaration.templateId === 'basketball-lines-card') {
      return {
        ...template.example,
        homeLabel: homeName || 'Home',
        awayLabel: awayName || 'Away',
      };
    }
    return template.example;
  })();

  return [
    `Animation Type: ${animationType}`,
    `Template ID: ${declaration.templateId}`,
    `Template Name: ${template.name}`,
    `Required Params: ${declaration.requiredParams.join(', ') || 'none'}`,
    'Parameter Schema:',
    JSON.stringify(declaration.schema, null, 2),
    'Example Params:',
    JSON.stringify(prefillExample, null, 2),
    `Segment Title: ${title}`,
  ].join('\n');
}
