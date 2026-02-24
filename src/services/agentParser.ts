export interface AgentSegment {
  id: string;
  thoughts: string;
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

  // Use regex to find all <thought>...</thought> and <animation>...</animation> blocks
  // We use [\s\S]*? for lazy matching across newlines
  const thoughtMatches = [...text.matchAll(/<thought>([\s\S]*?)(?:<\/thought>|$)/g)];
  const animationMatches = [...text.matchAll(/<animation>([\s\S]*?)(?:<\/animation>|$)/g)];
  const summaryMatch = text.match(/<summary>([\s\S]*?)(?:<\/summary>|$)/);

  for (let i = 0; i < thoughtMatches.length; i++) {
    const thoughtContent = thoughtMatches[i][1].trim();
    const thoughtMatchStr = thoughtMatches[i][0];
    const isThoughtComplete = thoughtMatchStr.endsWith('</thought>');

    let animContent = '';
    let animComplete = false;
    let animationObj = null;

    if (animationMatches[i]) {
      animContent = animationMatches[i][1].trim();
      animComplete = animationMatches[i][0].endsWith('</animation>');
      if (animComplete) {
        try {
          // Clean up markdown code blocks if AI added them inside the tag
          const cleanJson = animContent.replace(/```json/g, '').replace(/```/g, '').trim();
          animationObj = JSON.parse(cleanJson);
        } catch (e) {
          // JSON parse failed, might be incomplete or malformed
        }
      }
    }

    segments.push({
      id: `seg_${i}`,
      thoughts: thoughtContent,
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
      try {
        const cleanJson = summaryJson.replace(/```json/g, '').replace(/```/g, '').trim();
        summary = JSON.parse(cleanJson);
      } catch (e) {}
    }
    isComplete = summaryComplete;
  }

  return { segments, summaryJson, summary, isComplete };
}
