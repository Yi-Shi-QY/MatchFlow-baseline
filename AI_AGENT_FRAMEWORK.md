# MatchFlow AI Agent Framework

## 1. Overview

MatchFlow utilizes a Multi-Agent System (MAS) architecture to provide deep, structured, and engaging football match analysis. Instead of relying on a single prompt to generate a monolithic block of text, the system orchestrates a team of specialized AI agents. Each agent has a distinct persona, focus area, and set of skills, working together in a pipeline to produce a comprehensive final report.

The framework is designed to be:
- **Modular:** New agents can be easily added for specific analysis types (e.g., a "Referee Analyst" or "Weather Analyst").
- **Structured:** Output is strictly formatted using XML-like tags (`<thought>`, `<animation>`, `<summary>`, `<tags>`) to allow the frontend to parse and render the analysis incrementally.
- **Multilingual:** All agents support dynamic switching between English (`en`) and Chinese (`zh`) based on user settings.
- **Model Agnostic:** The core logic (`src/services/ai.ts`) abstracts the underlying LLM provider, currently supporting both Google Gemini and DeepSeek.

## 2. Core Architecture

The AI workflow is divided into three main phases, orchestrated by `streamAgentThoughts` in `src/services/ai.ts`:

### Phase 1: Planning (The Director)
Before any analysis begins, a **Planner Agent** evaluates the available match data (basic info, stats, odds, custom info) and creates a structured "Analysis Plan".
- **Planning Modes (Switched via Settings):**
  - **Template Mode (Default - `planner_template.ts`):** It evaluates the data richness and uses the `select_plan_template` skill to fetch a predefined, optimized plan template (e.g., `basic`, `standard`, `odds_focused`, `comprehensive`). This ensures high reliability and consistency. For reasoning models (like R1), it is optimized for speed by stopping generation immediately after the tool call. For native tool-calling models (V3/Gemini), it allows the model to complete the turn for better stability.
  - **Autonomous Mode (`planner_autonomous.ts`):** If the user enables "Autonomous Planning" in settings, this agent manually generates a custom plan from scratch using LLM reasoning.
- **Input:** Raw match data JSON.
- **Output:** A JSON array of segments (e.g., Overview -> Form -> Tactics -> Odds -> Prediction).
- **Logic:** It decides *which* agents to call, *what* animations to generate, and *how* context should be passed (`contextMode`).

### Phase 2: Execution (The Specialists)
The system iterates through the plan generated in Phase 1. For each segment, it invokes a specific **Specialist Agent**.
- **Controllable Context Passing (Context Modes & Dependencies):** 
  - **Context Dependencies:** Each agent defines *which* other agents it wants to listen to via the `contextDependencies` property in its config (e.g., `'all'`, `'none'`, or specific IDs like `['stats', 'tactical']`). The framework filters the history before passing it to the agent.
  - **Context Modes:** The Planner assigns a `contextMode` to dictate *how* the agent should use this filtered context:
    - `build_upon` (Default): Build on previous analysis, avoid repeating basics.
    - `independent`: Analyze independently from a different angle (e.g., Asian vs Euro odds). Redundancy is acceptable.
    - `compare`: Explicitly compare findings with previous segments.
- **Input:** Match data + Specific segment instructions (Title, Focus, Animation requirement, Context Mode) + Filtered Previous Analysis Context.
- **Output:** A stream of text containing a `<thought>` block (the analysis) and optionally an `<animation>` block (JSON data for video generation).
- **Tagging:** Immediately after a specialist finishes a segment, the **Tag Agent** reads the output and extracts 3-5 key insights (e.g., "High Pressing", "Home Advantage") to display as UI badges.

### Phase 3: Summarization (The Editor)
Once all segments are complete, the **Summary Agent** reviews the entire generated text.
- **Input:** The concatenated output of all specialist agents + Match data.
- **Output:** A `<summary>` block containing a concise prediction, win probabilities (home/draw/away), expected goals (xG), and key factors in strict JSON format.

## 3. The Agent Roster (`src/agents/`)

All agents implement the `AgentConfig` interface defined in `types.ts`:
```typescript
export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  skills?: string[]; // e.g., ['calculator']
  systemPrompt: (context: AgentContext) => string;
}
```

### 3.1. Orchestration Agents
*   **Template Planner Agent (`planner_template.ts`)**: "Template Planner". Selects a predefined analysis plan template using tools. Optimized for speed.
*   **Autonomous Planner Agent (`planner_autonomous.ts`)**: "Autonomous Planner". Manually plans the analysis structure for custom requests.
*   **Tag Agent (`tag.ts`)**: "Tag Extractor". Reads a completed analysis segment and extracts 3-5 short, color-coded tags (e.g., "Weak Defense").
*   **Summary Agent (`summary.ts`)**: "Summary Analyst". Reads the full analysis and generates the final JSON summary (probabilities, xG, final prediction).

### 3.2. Specialist Agents
These agents use a shared utility (`utils.ts` and `prompts.ts`) to ensure consistent output formatting (`<thought>` and `<animation>` tags) while injecting their unique personas.

*   **Overview Agent (`overview.ts`)**: "Lead Sports Journalist". Sets the stage, history, and stakes of the match.
*   **Stats Agent (`stats.ts`)**: "Data Scientist". Deeply analyzes numbers, comparing form, head-to-head records, and key metrics. (Has access to `calculator` skill).
*   **Tactical Agent (`tactical.ts`)**: "Tactical Analyst". Breaks down formations, key battles, and strategic approaches using technical terms.
*   **Odds Agent (`odds.ts`)**: "Odds Analyst". Specializes in Chinese Sports Lottery (Jingcai) odds (HAD/HHAD), discussing implied probabilities, value bets, and traps. (Has access to `calculator` skill).
*   **Prediction Agent (`prediction.ts`)**: "Senior Pundit". Weighs all factors, discusses psychology, and provides a reasoned prediction. (Has access to `calculator` skill).
*   **General Agent (`general.ts`)**: Fallback agent for general analysis if a specific type is not requested.

## 4. Prompt Engineering & Formatting

To ensure the frontend can parse the streaming response in real-time, the Specialist Agents are strictly instructed via `src/agents/prompts.ts` to output in this format:

```xml
<Segment Title>
<thought>
Your professional report here. Use Markdown formatting.
</thought>
<animation>
{
  "type": "stats",
  "title": "Recent Form",
  "narration": "Voiceover script...",
  "data": { ... }
}
</animation>
```

The `agentParser.ts` service listens to the stream and uses regex to extract these blocks, updating the UI progressively.

## 5. Tool Calling (Skills)

The framework supports OpenAI-compatible tool calling (Function Calling).
- Skills are defined in `src/skills/index.ts` (e.g., a `calculator` tool).
- Agents can declare required skills in their `AgentConfig` (e.g., `skills: ['calculator']`).
- The `streamAIRequest` function in `ai.ts` handles the tool execution loop: it intercepts the model's request to use a tool, executes the local TypeScript function, and feeds the result back to the model before continuing the stream.

## 6. Provider Abstraction (`ai.ts`)

The `streamAIRequest` function handles the complexities of communicating with different LLM providers:
- **Gemini:** Uses the official `@google/genai` SDK, utilizing `chat.sendMessageStream` and handling `functionCalls` natively.
- **DeepSeek:** Uses standard `fetch` to call the OpenAI-compatible endpoint (`https://api.deepseek.com/chat/completions`). It manually parses the Server-Sent Events (SSE) stream and handles tool calls by appending `tool` role messages to the conversation history.

This abstraction allows the rest of the application (and the agents themselves) to remain completely unaware of which AI model is currently active.
