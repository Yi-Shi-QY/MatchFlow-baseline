import type { RuntimeMemoryScopeType } from '@/src/domains/runtime/types';

export type MemoryCandidateStatus = 'pending' | 'enabled' | 'dismissed';
export type MemoryCandidateSourceKind =
  | 'explicit_preference'
  | 'explicit_constraint'
  | 'stable_habit'
  | 'automation_result';
export type MemoryCandidateOrigin = 'manager_turn' | 'automation_result';
export type MemoryCandidateConflictKind =
  | 'none'
  | 'memory_content'
  | 'candidate_content';
export type MemoryCandidateDetectionMode =
  | 'freeform'
  | 'analysis_factors'
  | 'analysis_sequence'
  | 'analysis_profile';

export interface MemoryCandidateInput {
  sourceKind: MemoryCandidateSourceKind;
  origin?: MemoryCandidateOrigin;
  scopeType: RuntimeMemoryScopeType;
  scopeId: string;
  memoryType: string;
  keyText: string;
  contentText: string;
  title?: string;
  reasoning?: string;
  evidence?: string[];
  createdAt?: number;
  updatedAt?: number;
}

export interface MemoryCandidateRecord {
  id: string;
  fingerprint: string;
  sourceKind: MemoryCandidateSourceKind;
  origin: MemoryCandidateOrigin;
  status: MemoryCandidateStatus;
  scopeType: RuntimeMemoryScopeType;
  scopeId: string;
  memoryType: string;
  keyText: string;
  contentText: string;
  title: string;
  reasoning: string;
  evidence: string[];
  conflictKind: MemoryCandidateConflictKind;
  conflictMemoryId: string | null;
  conflictCandidateId: string | null;
  createdAt: number;
  updatedAt: number;
  enabledAt: number | null;
  dismissedAt: number | null;
}
