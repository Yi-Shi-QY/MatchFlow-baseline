export const oddsAnimationTemplate = (title: string, homeName: string, awayName: string) => `
<animation>
{
  "type": "odds",
  "title": "${title}",
  "narration": "A short, engaging voiceover script for this animation.",
  "data": {
    "homeLabel": "${homeName}", "awayLabel": "${awayName}",
    "had": { "h": 1.5, "d": 3.2, "a": 4.5 },
    "hhad": { "h": 2.1, "d": 3.5, "a": 2.8, "goalline": -1 }
  }
}
</animation>`;
