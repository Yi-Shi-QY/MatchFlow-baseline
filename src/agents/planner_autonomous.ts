import { AgentConfig } from "./types";
import {
  buildAutonomousPlannerPrompt,
  resolveAnalysisTarget,
  resolvePlannerDomainId,
} from "./autonomousPlannerPrompt";

export const plannerAutonomousAgent: AgentConfig = {
  id: "planner_autonomous",
  name: "Autonomous Planner",
  description: "Manually plans the analysis structure for custom requests.",
  skills: [],
  systemPrompt: (context) => {
    const language = context.language === "zh" ? "zh" : "en";
    const domainId = resolvePlannerDomainId(context);
    const target = resolveAnalysisTarget(context.matchData, language);

    return buildAutonomousPlannerPrompt({
      context,
      language,
      domainId,
      target,
      plannerTitle: "Domain Analysis Planning Director",
      fallbackAgentTypes: ["general"],
      fallbackAnimationTypes: ["none"],
      fallbackSourceIds: [],
    });
  },
};
