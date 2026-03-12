import { getSettings, type AIProvider } from '@/src/services/settings';
import { DEFAULT_AUTOMATION_PROVIDER_CAPS } from './constants';
import type { AutomationConcurrencyBudget } from './concurrencyBudget';
import type { AutomationJob } from './types';

export interface AutomationProviderBudget {
  provider: AIProvider;
  model: string;
  key: string;
  maxParallelJobs: number;
}

export interface AutomationProviderBudgetInput {
  provider?: AIProvider;
  model?: string;
  totalConcurrency?: number;
}

function normalizeProviderModelCap(provider: AIProvider, model: string): number {
  let limit = DEFAULT_AUTOMATION_PROVIDER_CAPS[provider];
  const normalizedModel = model.toLowerCase();

  if (normalizedModel.includes('pro') || normalizedModel.includes('reasoner')) {
    limit = Math.max(1, limit - 1);
  }

  if (normalizedModel.includes('flash') || normalizedModel.includes('mini')) {
    limit += 1;
  }

  return Math.max(1, limit);
}

export function resolveAutomationProviderBudget(
  input: AutomationProviderBudgetInput = {},
): AutomationProviderBudget {
  const settings = getSettings();
  const provider = input.provider || settings.provider;
  const model = (input.model || settings.model || '').trim() || 'unknown';
  const providerCap = normalizeProviderModelCap(provider, model);
  const totalConcurrency =
    typeof input.totalConcurrency === 'number' && Number.isFinite(input.totalConcurrency)
      ? Math.max(0, Math.floor(input.totalConcurrency))
      : providerCap;

  return {
    provider,
    model,
    key: `${provider}:${model}`,
    maxParallelJobs: Math.min(providerCap, totalConcurrency),
  };
}

export function resolveAutomationProviderBudgetForJob(
  _job: AutomationJob,
  budget: AutomationConcurrencyBudget,
): AutomationProviderBudget {
  return resolveAutomationProviderBudget({
    totalConcurrency: budget.maxParallelJobs,
  });
}
