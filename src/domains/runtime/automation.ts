import type {
  AutomationDraft,
  AutomationJob,
  AutomationParserOptions,
} from '@/src/services/automation/types';
import type { SubjectDisplay } from '@/src/services/subjectDisplay';

export interface DomainAutomationResolvedTarget {
  domainId: string;
  subjectId: string;
  subjectType: string;
  title: string;
  subjectDisplay: SubjectDisplay;
}

export interface DomainAutomationCapability {
  resolveJobTargets(job: AutomationJob): Promise<DomainAutomationResolvedTarget[]>;
  createSyntheticTarget(job: AutomationJob): Promise<DomainAutomationResolvedTarget>;
  parseCommand?(
    sourceText: string,
    options: AutomationParserOptions,
  ): AutomationDraft[] | null;
}
