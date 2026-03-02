import type { Match } from "@/src/data/matches";
import type { DataSourceDefinition, SourceSelection } from "@/src/services/dataSources";

export interface AnalysisDomainContext {
  match: Match;
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
    match: Match,
    importedData?: any,
    previousSelection?: Partial<SourceSelection>,
  ) => SourceSelection;
  buildSourceCapabilities: (data: any, selectedSources: SourceSelection) => Record<string, any>;
}
