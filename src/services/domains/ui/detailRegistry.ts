import React from 'react';
import type { AnalysisDomain } from '@/src/services/domains/types';

export interface SubjectDetailInput {
  domain: AnalysisDomain;
  domainId: string;
  subjectId: string;
  subjectType: string;
  routeState?: unknown;
}

export interface SubjectDetailViewModel {
  element: React.ReactElement;
}

export interface DomainSubjectDetailAdapter {
  domainId: string;
  canRender(subjectType: string): boolean;
  buildViewModel(input: SubjectDetailInput): SubjectDetailViewModel;
}

type DomainSubjectDetailAdapterModule = {
  DOMAIN_SUBJECT_DETAIL_ADAPTERS?: DomainSubjectDetailAdapter[];
};

function collectBuiltinDomainSubjectDetailAdapters(): Record<string, DomainSubjectDetailAdapter[]> {
  const modules = import.meta.glob('./detailAdapters/*.ts', { eager: true }) as Record<
    string,
    DomainSubjectDetailAdapterModule
  >;
  const adapterMap: Record<string, DomainSubjectDetailAdapter[]> = {};

  Object.entries(modules)
    .sort(([pathA], [pathB]) => pathA.localeCompare(pathB))
    .forEach(([_modulePath, module]) => {
      const adapters = Array.isArray(module.DOMAIN_SUBJECT_DETAIL_ADAPTERS)
        ? module.DOMAIN_SUBJECT_DETAIL_ADAPTERS
        : [];
      adapters.forEach((adapter) => {
        if (!adapter?.domainId || typeof adapter.canRender !== 'function') {
          return;
        }
        if (!adapterMap[adapter.domainId]) {
          adapterMap[adapter.domainId] = [];
        }
        adapterMap[adapter.domainId].push(adapter);
      });
    });

  return adapterMap;
}

export const BUILTIN_DOMAIN_SUBJECT_DETAIL_ADAPTERS =
  collectBuiltinDomainSubjectDetailAdapters();

export function getDomainSubjectDetailAdapter(input: {
  domainId: string;
  subjectType: string;
}): DomainSubjectDetailAdapter | null {
  const adapters = BUILTIN_DOMAIN_SUBJECT_DETAIL_ADAPTERS[input.domainId] || [];
  return adapters.find((adapter) => adapter.canRender(input.subjectType)) || null;
}
