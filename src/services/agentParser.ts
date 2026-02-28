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

export function parseAgentStream(text: string): AgentResult {
  const segments: AgentSegment[] = [];
  let summaryJson = '';
  let summary = null;
  let isComplete = false;

  // Use regex to find all blocks
  const titleMatches = [...text.matchAll(/<title>([\s\S]*?)(?:<\/title>|$)/g)];
  const thoughtMatches = [...text.matchAll(/<thought>([\s\S]*?)(?:<\/thought>|$)/g)];
  const tagsMatches = [...text.matchAll(/<tags>([\s\S]*?)(?:<\/tags>|$)/g)];
  const animationMatches = [...text.matchAll(/<animation>([\s\S]*?)(?:<\/animation>|$)/g)];
  const summaryMatch = text.match(/<summary>([\s\S]*?)(?:<\/summary>|$)/);

  // We rely on thoughts as the primary segment anchor
  for (let i = 0; i < thoughtMatches.length; i++) {
    const thoughtContent = thoughtMatches[i][1].trim();
    const thoughtMatchStr = thoughtMatches[i][0];
    const isThoughtComplete = thoughtMatchStr.endsWith('</thought>');

    let title = '';
    if (titleMatches[i]) {
      title = titleMatches[i][1].trim();
    }

    let tags: AgentTag[] = [];
    if (tagsMatches[i]) {
      const tagsContent = tagsMatches[i][1].trim();
      if (tagsContent && tagsMatches[i][0].endsWith('</tags>')) {
        tags = extractJson(tagsContent) || [];
      }
    }

    let animContent = '';
    let animComplete = false;
    let animationObj = null;

    if (animationMatches[i]) {
      animContent = animationMatches[i][1].trim();
      animComplete = animationMatches[i][0].endsWith('</animation>');
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
