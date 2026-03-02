import { extractJson } from "../utils/json";

export interface AgentTag {
  label: string;
  team: 'home' | 'away' | 'neutral';
  color?: string; // Optional, for UI mapping
}

export interface AgentSegment {
  id: string;
  title: string;
  thoughts: string;
  tags: AgentTag[];
  animationJson: string;
  animation: any | null;
  isThoughtComplete: boolean;
  isAnimationComplete: boolean;
}

export interface AgentResult {
  segments: AgentSegment[];
  summaryJson: string;
  summary: any | null;
  isComplete: boolean;
}

const STRUCTURED_TAG_START_RE = /<(?:title|thought|animation|tags|summary)>/i;

function stripReasoningArtifacts(text: string): string {
  if (!text) return "";

  let clean = text;

  // Reasoner models may stream hidden thinking traces that can contain
  // pseudo tags and destabilize incremental UI parsing.
  clean = clean.replace(/<think>[\s\S]*?<\/think>/gi, "");
  clean = clean.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "");
  clean = clean.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "");
  clean = clean.replace(/<\|begin_of_thought\|>[\s\S]*?<\|end_of_thought\|>/gi, "");

  // If reasoning starts the response but is not properly closed,
  // trim only the leading reasoning chunk and keep downstream structured output.
  clean = clean.replace(
    /^\s*<(?:think|thinking|reasoning)>[\s\S]*?(?=<(?:title|thought|animation|tags|summary)>|$)/i,
    "",
  );
  clean = clean.replace(
    /^\s*<\|begin_of_thought\|>[\s\S]*?(?=<(?:title|thought|animation|tags|summary)>|$)/i,
    "",
  );

  // As a final fallback, if the text still starts with an unrecognized reasoning prelude,
  // jump to the first structured tag.
  if (!STRUCTURED_TAG_START_RE.test(clean) && STRUCTURED_TAG_START_RE.test(text)) {
    const firstStructured = text.search(STRUCTURED_TAG_START_RE);
    if (firstStructured >= 0) {
      clean = text.slice(firstStructured);
    }
  }

  return clean;
}

function getMatchStart(match: RegExpMatchArray | undefined): number {
  if (!match || typeof match.index !== "number") return -1;
  return match.index;
}

function findLastMatchBefore(
  matches: RegExpMatchArray[],
  before: number,
  minInclusive: number,
): RegExpMatchArray | undefined {
  for (let i = matches.length - 1; i >= 0; i--) {
    const idx = getMatchStart(matches[i]);
    if (idx < 0) continue;
    if (idx >= minInclusive && idx < before) {
      return matches[i];
    }
  }
  return undefined;
}

function findLastMatchInRange(
  matches: RegExpMatchArray[],
  minInclusive: number,
  maxExclusive: number,
): RegExpMatchArray | undefined {
  for (let i = matches.length - 1; i >= 0; i--) {
    const idx = getMatchStart(matches[i]);
    if (idx < 0) continue;
    if (idx >= minInclusive && idx < maxExclusive) {
      return matches[i];
    }
  }
  return undefined;
}

export function parseAgentStream(text: string): AgentResult {
  const safeText = stripReasoningArtifacts(text);
  const segments: AgentSegment[] = [];
  let summaryJson = '';
  let summary = null;
  let isComplete = false;

  // Use regex to find all blocks
  const titleMatches = [...safeText.matchAll(/<title>([\s\S]*?)(?:<\/title>|$)/g)];
  const thoughtMatches = [...safeText.matchAll(/<thought>([\s\S]*?)(?:<\/thought>|$)/g)];
  const tagsMatches = [...safeText.matchAll(/<tags>([\s\S]*?)(?:<\/tags>|$)/g)];
  const animationMatches = [...safeText.matchAll(/<animation>([\s\S]*?)(?:<\/animation>|$)/g)];
  const summaryMatch = safeText.match(/<summary>([\s\S]*?)(?:<\/summary>|$)/);
  const summaryStart = getMatchStart(summaryMatch || undefined);

  // We rely on thoughts as the primary segment anchor
  for (let i = 0; i < thoughtMatches.length; i++) {
    const thoughtMatch = thoughtMatches[i];
    const thoughtContent = thoughtMatch[1].trim();
    const thoughtMatchStr = thoughtMatch[0];
    const isThoughtComplete = thoughtMatchStr.endsWith('</thought>');
    const currentThoughtStart = getMatchStart(thoughtMatch);
    const previousThoughtStart = i > 0 ? getMatchStart(thoughtMatches[i - 1]) : 0;
    const nextThoughtStart = i + 1 < thoughtMatches.length ? getMatchStart(thoughtMatches[i + 1]) : -1;
    const segmentEnd =
      nextThoughtStart >= 0
        ? nextThoughtStart
        : summaryStart >= 0
          ? summaryStart
          : safeText.length;

    let title = '';
    const titleMatchBefore = findLastMatchBefore(
      titleMatches,
      currentThoughtStart >= 0 ? currentThoughtStart : segmentEnd,
      Math.max(0, previousThoughtStart),
    );
    const titleMatchInRange = findLastMatchInRange(
      titleMatches,
      Math.max(0, currentThoughtStart),
      segmentEnd,
    );
    const titleMatch = titleMatchBefore || titleMatchInRange;
    if (titleMatch) title = titleMatch[1].trim();

    let tags: AgentTag[] = [];
    const tagsMatch = findLastMatchInRange(
      tagsMatches,
      Math.max(0, currentThoughtStart),
      segmentEnd,
    );
    if (tagsMatch) {
      const tagsContent = tagsMatch[1].trim();
      if (tagsContent && tagsMatch[0].endsWith('</tags>')) {
        tags = extractJson(tagsContent) || [];
      }
    }

    let animContent = '';
    let animComplete = false;
    let animationObj = null;

    const animationMatch = findLastMatchInRange(
      animationMatches,
      Math.max(0, currentThoughtStart),
      segmentEnd,
    );
    if (animationMatch) {
      animContent = animationMatch[1].trim();
      animComplete = animationMatch[0].endsWith('</animation>');
      if (animComplete) {
        animationObj = extractJson(animContent);
      }
    }

    segments.push({
      id: `seg_${i}`,
      title,
      thoughts: thoughtContent,
      tags,
      animationJson: animContent,
      animation: animationObj,
      isThoughtComplete,
      isAnimationComplete: animComplete,
    });
  }

  if (summaryMatch) {
    summaryJson = summaryMatch[1].trim();
    const summaryComplete = summaryMatch[0].endsWith('</summary>');
    if (summaryComplete) {
      summary = extractJson(summaryJson);
    }
    isComplete = summaryComplete;
  }

  return { segments, summaryJson, summary, isComplete };
}
