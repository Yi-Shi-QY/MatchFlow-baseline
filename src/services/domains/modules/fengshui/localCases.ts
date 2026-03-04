import { MOCK_MATCHES, type Match } from "@/src/data/matches";
import { cloneMatch } from "../shared/cloneMatch";

function buildCase(
  base: Match,
  config: {
    id: string;
    subjectName: string;
    referenceFrame: string;
    propertyType: string;
    facingDirection: string;
    constructionPeriod: string;
    cycleStage: string;
    status: Match["status"];
    qiFlowScore: number;
    brightHallScore: number;
    shaPressure: number;
    circulationScore: number;
    entryStability: number;
    yearlyInfluence: number;
    monthlyInfluence: number;
    favorableWindow: string;
    cautionWindow: string;
    intentSummary: string;
    priorities: string[];
    constraints: string[];
  },
): Match {
  const cloned = cloneMatch(base);

  return {
    ...cloned,
    id: config.id,
    league: "Feng Shui Advisory Desk",
    status: config.status,
    homeTeam: {
      ...cloned.homeTeam,
      id: `${config.id}_subject`,
      name: config.subjectName,
      logo: "",
      form: [],
    },
    awayTeam: {
      ...cloned.awayTeam,
      id: `${config.id}_reference`,
      name: config.referenceFrame,
      logo: "",
      form: [],
    },
    capabilities: {
      hasStats: true,
      hasOdds: true,
      hasCustom: true,
    },
    siteProfile: {
      subjectName: config.subjectName,
      referenceFrame: config.referenceFrame,
      propertyType: config.propertyType,
      facingDirection: config.facingDirection,
      constructionPeriod: config.constructionPeriod,
    },
    qiFlow: {
      qiFlowScore: config.qiFlowScore,
      brightHallScore: config.brightHallScore,
      shaPressure: config.shaPressure,
      circulationScore: config.circulationScore,
      entryStability: config.entryStability,
    },
    temporalCycle: {
      cycleStage: config.cycleStage,
      yearlyInfluence: config.yearlyInfluence,
      monthlyInfluence: config.monthlyInfluence,
      favorableWindow: config.favorableWindow,
      cautionWindow: config.cautionWindow,
    },
    occupantIntent: {
      intentSummary: config.intentSummary,
      priorities: config.priorities,
      constraints: config.constraints,
    },
    customInfo: config.intentSummary,
  } as Match;
}

export function buildFengshuiLocalCases(caseMinimum: number): Match[] {
  const normalizedCount = Math.max(3, Math.floor(caseMinimum));
  const bases = [
    MOCK_MATCHES[0] || MOCK_MATCHES[MOCK_MATCHES.length - 1],
    MOCK_MATCHES[1] || MOCK_MATCHES[0],
    MOCK_MATCHES[2] || MOCK_MATCHES[0],
  ];

  const seedCases: Match[] = [
    buildCase(bases[0], {
      id: "fengshui_case_1",
      subjectName: "Riverview Apartment A",
      referenceFrame: "South Ridge Axis",
      propertyType: "Residential",
      facingDirection: "South-East",
      constructionPeriod: "Period 9",
      cycleStage: "Expansion Phase",
      status: "live",
      qiFlowScore: 78,
      brightHallScore: 72,
      shaPressure: 34,
      circulationScore: 69,
      entryStability: 66,
      yearlyInfluence: 4.2,
      monthlyInfluence: 2.1,
      favorableWindow: "Solar term: Grain Rain to Start of Summer",
      cautionWindow: "Conflict days around monthly break points",
      intentSummary:
        "Prioritize family health and study concentration while preserving long-term savings flow.",
      priorities: ["Health", "Study", "Savings"],
      constraints: ["Renovation budget limit", "No structural demolition"],
    }),
    buildCase(bases[1], {
      id: "fengshui_case_2",
      subjectName: "Harbor Retail Unit 17",
      referenceFrame: "Main Street Flow",
      propertyType: "Commercial",
      facingDirection: "West",
      constructionPeriod: "Late Period 8",
      cycleStage: "Transition Phase",
      status: "upcoming",
      qiFlowScore: 59,
      brightHallScore: 54,
      shaPressure: 62,
      circulationScore: 57,
      entryStability: 49,
      yearlyInfluence: -1.8,
      monthlyInfluence: -3.2,
      favorableWindow: "Evening traffic peaks with mild weather days",
      cautionWindow: "High-conflict weekdays after inventory reset",
      intentSummary:
        "Stabilize customer conversion and reduce operational stress before the next sales cycle.",
      priorities: ["Cashflow stability", "Team harmony", "Brand visibility"],
      constraints: ["Fixed storefront orientation", "Limited operating hours"],
    }),
    buildCase(bases[2], {
      id: "fengshui_case_3",
      subjectName: "North Gate Office 12F",
      referenceFrame: "River Bend Alignment",
      propertyType: "Office",
      facingDirection: "North",
      constructionPeriod: "Period 9",
      cycleStage: "Consolidation Phase",
      status: "finished",
      qiFlowScore: 67,
      brightHallScore: 63,
      shaPressure: 41,
      circulationScore: 64,
      entryStability: 71,
      yearlyInfluence: 2.6,
      monthlyInfluence: 1.4,
      favorableWindow: "Quarter-opening review window",
      cautionWindow: "Contract cycle rollover week",
      intentSummary:
        "Improve leadership focus and decision quality while avoiding over-expansion risk.",
      priorities: ["Leadership clarity", "Negotiation outcomes", "Risk control"],
      constraints: ["Shared floor layout", "Short adjustment timeline"],
    }),
  ];

  if (seedCases.length >= normalizedCount) {
    return seedCases.slice(0, normalizedCount);
  }

  const padded = [...seedCases];
  while (padded.length < normalizedCount) {
    const source = seedCases[padded.length % seedCases.length];
    const sourceWithExtras = source as Match & Record<string, any>;
    const copy = {
      ...cloneMatch(source),
      customInfo: sourceWithExtras.customInfo,
      siteProfile: sourceWithExtras.siteProfile,
      qiFlow: sourceWithExtras.qiFlow,
      temporalCycle: sourceWithExtras.temporalCycle,
      occupantIntent: sourceWithExtras.occupantIntent,
    } as Match;
    copy.id = `fengshui_case_${padded.length + 1}`;
    padded.push(copy);
  }

  return padded;
}
