export interface AgentSegment {
  id: string;
  title: string;
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

  // Use regex to find all blocks
  const titleMatches = [...text.matchAll(/<title>([\s\S]*?)(?:<\/title>|$)/g)];
  const thoughtMatches = [...text.matchAll(/<thought>([\s\S]*?)(?:<\/thought>|$)/g)];
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

    let animContent = '';
    let animComplete = false;
    let animationObj = null;

    // We assume animations correspond 1:1 to thoughts if they exist in sequence
    // But since animation is optional, this index-based matching is risky if an animation is skipped.
    // However, the prompt structure usually enforces order. 
    // A better approach would be to parse the whole stream sequentially, but for now we'll stick to index matching 
    // assuming the agent follows the pattern <title><thought><animation?>.
    // Actually, if animation is optional, matchAll index might desync.
    // But typically we ask for <thought> then <animation>. 
    // If we want to be robust, we should parse by finding the content between tags.
    // Given the current constraint, let's assume the agent outputs <animation> or nothing.
    // If the agent skips <animation> for segment 1 but adds it for segment 2, `animationMatches[0]` will be the one for segment 2.
    // This is a known limitation of this regex approach. 
    // To fix this properly, we would need a state machine parser.
    // For this specific task (adding title), title is mandatory so index matching works for title.
    // Animation matching logic is unchanged from before, so I will leave it as is (index based).
    
    if (animationMatches[i]) {
       // Check if this animation match actually belongs to this segment.
       // This is hard with regex only. 
       // For now, we will assume the previous behavior was acceptable or that the agent 
       // tends to output consistent blocks. 
       // Actually, the previous code used `animationMatches[i]`. 
       // If segment 1 has no animation, and segment 2 has one, animationMatches[0] will be segment 2's animation.
       // This assigns segment 2's animation to segment 1. This is a bug in the existing code.
       // However, I am asked to add Title. I will fix Title.
       // I will leave animation logic as is to minimize regression risk unless I rewrite the parser.
       // But wait, if I add title, I can use it to anchor.
       
       // Let's stick to the requested change: Adding Title.
       animContent = animationMatches[i][1].trim();
       animComplete = animationMatches[i][0].endsWith('</animation>');
       if (animComplete) {
        try {
          const cleanJson = animContent.replace(/```json/g, '').replace(/```/g, '').trim();
          animationObj = JSON.parse(cleanJson);
        } catch (e) {}
       }
    }
    
    // Improved Animation Matching (Optional fix):
    // We can check if the animation match index is roughly after the thought match index in the original string.
    // But `matchAll` returns global indices.
    // let's just use the index for now.

    segments.push({
      id: `seg_${i}`,
      title,
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
