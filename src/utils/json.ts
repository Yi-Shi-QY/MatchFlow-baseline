export function extractJson(text: string): any {
  if (!text) return null;
  
  // Strip reasoning tags if they exist (DeepSeek R1)
  let clean = text.replace(/<think>[\s\S]*?<\/think>/g, '');
  
  // Try direct parse first
  try {
    return JSON.parse(clean);
  } catch (e) {}

  // Try removing markdown code blocks
  const withoutMarkdown = clean.replace(/```json/g, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(withoutMarkdown);
  } catch (e) {}

  // Strategy: Find all occurrences of { and [ and try to parse from there
  // We'll try to find the longest valid JSON string
  const findValidJson = (str: string) => {
    const starts = [];
    for (let i = 0; i < str.length; i++) {
      if (str[i] === '{' || str[i] === '[') starts.push(i);
    }
    
    const ends = [];
    for (let i = 0; i < str.length; i++) {
      if (str[i] === '}' || str[i] === ']') ends.push(i);
    }
    
    // Sort ends in descending order to try largest blocks first
    ends.sort((a, b) => b - a);
    
    for (const start of starts) {
      for (const end of ends) {
        if (end > start) {
          let candidate = str.substring(start, end + 1);
          
          // Try parsing candidate
          try {
            const parsed = JSON.parse(candidate);
            if (parsed !== null && typeof parsed === 'object') return parsed;
          } catch (e) {
            // Try fixing trailing commas and parse again
            try {
              const fixedCandidate = candidate.replace(/,\s*([\]}])/g, '$1');
              const parsed = JSON.parse(fixedCandidate);
              if (parsed !== null && typeof parsed === 'object') return parsed;
            } catch (e2) {
              // continue
            }
          }
        }
      }
    }
    return null;
  };

  const result = findValidJson(clean) || findValidJson(withoutMarkdown);
  if (result) return result;

  return null;
}
