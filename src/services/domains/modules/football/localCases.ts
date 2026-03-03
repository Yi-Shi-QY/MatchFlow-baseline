import { MOCK_MATCHES, type Match } from "@/src/data/matches";
import { cloneMatch } from "../shared/cloneMatch";

export function buildFootballLocalCases(caseMinimum: number): Match[] {
  const count = Math.max(0, Math.floor(caseMinimum));
  return MOCK_MATCHES.slice(0, count).map(cloneMatch);
}

