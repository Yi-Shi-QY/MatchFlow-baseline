import type { DataSourceDefinition, SourceSelection } from "@/src/services/dataSources";
import type { SubjectDisplay } from "@/src/services/subjectDisplay";

export interface AnalysisDomainContext {
  subjectDisplay: SubjectDisplay;
  importedData?: any;
}

export interface DomainResourceIds {
  templates?: string[];
  animations?: string[];
  agents?: string[];
  skills?: string[];
}

export interface AnalysisDomain {
  id: string;
  name: string;
  description: string;
  resources?: DomainResourceIds;
  dataSources: DataSourceDefinition[];
  getAvailableDataSources: (context: AnalysisDomainContext) => DataSourceDefinition[];
  resolveSourceSelection: (
    subjectDisplay: SubjectDisplay,
    importedData?: any,
    previousSelection?: Partial<SourceSelection>,
  ) => SourceSelection;
  buildSourceCapabilities: (data: any, selectedSources: SourceSelection) => Record<string, any>;
}
