import {
  ANALYSIS_DATA_SOURCES,
  buildSourceCapabilities,
  resolveSourceSelection,
} from "@/src/services/dataSources";
import type { AnalysisDomain } from "../../types";

export const footballDomain: AnalysisDomain = {
  id: "football",
  name: "Football Analysis",
  description: "Built-in football match analysis experience.",
  resources: {
    templates: ["basic", "standard", "odds_focused", "comprehensive"],
    animations: ["stats-comparison", "odds-card", "tactical-board"],
    agents: [
      "overview",
      "stats",
      "tactical",
      "prediction",
      "general",
      "football_planner_template",
      "football_planner_autonomous",
      "tag",
      "summary",
      "odds",
      "animation",
    ],
    skills: ["calculator", "select_plan_template"],
  },
  dataSources: ANALYSIS_DATA_SOURCES,
  getAvailableDataSources: (context) =>
    ANALYSIS_DATA_SOURCES.filter((source) => source.isAvailable(context)),
  resolveSourceSelection: (subjectDisplay, importedData, previousSelection) =>
    resolveSourceSelection(subjectDisplay, importedData, previousSelection),
  buildSourceCapabilities,
};
