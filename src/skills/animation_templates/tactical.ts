export const tacticalAnimationTemplate = (title: string, homeName: string, awayName: string) => `
<animation>
{
  "type": "tactical",
  "title": "${title}",
  "narration": "A short, engaging voiceover script for this animation.",
  "data": {
    "homeLabel": "${homeName}", "awayLabel": "${awayName}",
    "homeValue": 10, "awayValue": 5,
    "metric": "REPLACE_WITH_REAL_METRIC"
  }
}
</animation>`;
