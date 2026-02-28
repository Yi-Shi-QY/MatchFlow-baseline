# Agent Construction Guide (I18n Compatible)

This guide outlines the best practices for creating Agents in this project, with a strict focus on Internationalization (i18n) compatibility.

## 1. Agent Structure

All agents must implement the `AgentConfig` interface defined in `src/agents/types.ts`.

```typescript
export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  skills?: string[];
  contextDependencies?: string[] | 'all' | 'none';
  systemPrompt: (context: AgentContext) => string;
}
```

## 2. I18n Compatibility Rules

**Rule #1: Never Hardcode Language in System Prompts**

Do not write system prompts that are only in English or only in Chinese. You must handle the `context.language` property.

**Bad Pattern:**

```typescript
// ❌ BAD: Hardcoded English
systemPrompt: (context) => `You are a football analyst...`
```

**Good Pattern (Role-based):**

For simple agents that use `buildAnalysisPrompt`, define a `rolePrompts` object:

```typescript
// ✅ GOOD: Language-aware role definitions
const rolePrompts = {
  en: `You are a Senior Football Analyst...`,
  zh: `你是一位资深足球分析师...`
};

export const myAgent: AgentConfig = {
  // ...
  systemPrompt: (context) => {
    // Select the correct role description based on language
    const role = context.language === 'zh' ? rolePrompts.zh : rolePrompts.en;
    return buildAnalysisPrompt(role, context);
  }
};
```

**Good Pattern (Full Prompt Control):**

For complex agents that need full control over the prompt structure:

```typescript
// ✅ GOOD: Separate prompt generators
const prompts = {
  en: (data: any) => `Analyze this data: ${data}...`,
  zh: (data: any) => `分析这些数据：${data}...`
};

export const myComplexAgent: AgentConfig = {
  // ...
  systemPrompt: ({ matchData, language }) => {
    const promptGen = language === 'zh' ? prompts.zh : prompts.en;
    return promptGen(JSON.stringify(matchData));
  }
};
```

## 3. Utility Functions

Use `buildAnalysisPrompt` from `src/agents/utils.ts` whenever possible. It handles the common structure of:
1. Role Definition
2. Previous Context (if any)
3. Segment Details
4. Instructions
5. Output Format

It automatically switches the "scaffolding" text (headers like "INSTRUCTIONS", "OUTPUT FORMAT") based on `context.language`.

## 4. Checklist for New Agents

- [ ] Does the agent have a unique `id`?
- [ ] Is `systemPrompt` using `context.language`?
- [ ] Are all static strings in the prompt localized?
- [ ] If using `buildAnalysisPrompt`, is the `rolePrompt` localized?
