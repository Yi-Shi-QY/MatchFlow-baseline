import { GoogleGenAI, Type } from "@google/genai";

const TOOL_DECLARATIONS = {
  calculator: {
    name: "calculator",
    description: "Simple calculator (add/subtract/multiply/divide).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        operation: { type: Type.STRING },
        a: { type: Type.NUMBER },
        b: { type: Type.NUMBER },
      },
      required: ["operation", "a", "b"],
    },
  },
  select_plan_template: {
    name: "select_plan_template",
    description: "Select a plan template.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        templateType: { type: Type.STRING },
        language: { type: Type.STRING },
        includeAnimations: { type: Type.BOOLEAN },
      },
      required: ["templateType", "language", "includeAnimations"],
    },
  },
};

const PROBES = [
  {
    id: "calculator",
    expectedSkill: "calculator",
    prompt: [
      "You are running a tool-calling diagnostic.",
      "You MUST call the calculator tool exactly once with:",
      '{"operation":"multiply","a":19,"b":23}',
      "Do not do mental math.",
      "Do not explain anything.",
    ].join("\n"),
  },
  {
    id: "planner",
    expectedSkill: "select_plan_template",
    prompt: [
      "You are running a tool-calling diagnostic.",
      "You MUST call select_plan_template exactly once with:",
      '{"templateType":"standard","language":"en","includeAnimations":false}',
      "Do not output any extra text.",
    ].join("\n"),
  },
];

function getArgValue(name) {
  const target = `--${name}`;
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const current = args[i];
    if (current === target) return args[i + 1] ?? null;
    if (current.startsWith(`${target}=`)) return current.slice(target.length + 1);
  }
  return null;
}

function hasFlag(name) {
  const target = `--${name}`;
  return process.argv.slice(2).some((arg) => arg === target || arg.startsWith(`${target}=`));
}

function parseCasesArg(input) {
  return input
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [provider, model] = item.split(":").map((part) => part.trim());
      if (!provider || !model) {
        throw new Error(
          `Invalid --cases item "${item}". Use provider:model format (e.g. deepseek:deepseek-chat)`,
        );
      }
      if (!["deepseek", "gemini", "openai_compatible"].includes(provider)) {
        throw new Error(`Unsupported provider "${provider}" in --cases`);
      }
      return { provider, model, label: `${provider}/${model}` };
    });
}

function buildDefaultCases() {
  const cases = [];
  if (process.env.DEEPSEEK_API_KEY) {
    cases.push(
      { provider: "deepseek", model: "deepseek-chat", label: "deepseek/deepseek-chat" },
      {
        provider: "deepseek",
        model: "deepseek-reasoner",
        label: "deepseek/deepseek-reasoner",
      },
    );
  }
  if (process.env.GEMINI_API_KEY) {
    cases.push({
      provider: "gemini",
      model: "gemini-3-flash-preview",
      label: "gemini/gemini-3-flash-preview",
    });
  }
  if (process.env.OPENAI_API_KEY || process.env.OPENAI_COMPATIBLE_API_KEY) {
    cases.push({
      provider: "openai_compatible",
      model: "gpt-4o-mini",
      label: "openai_compatible/gpt-4o-mini",
    });
  }
  return cases;
}

function resolveOpenAIBaseUrl() {
  return (
    getArgValue("openai-base-url") ||
    process.env.OPENAI_BASE_URL ||
    process.env.OPENAI_COMPATIBLE_BASE_URL ||
    "https://api.openai.com/v1"
  );
}

function reasonerLikely(model) {
  const lower = String(model || "").toLowerCase();
  return lower.includes("reasoner") || /(^|[^a-z0-9])r1([^a-z0-9]|$)/.test(lower);
}

function executeLocalTool(name, args) {
  if (name === "calculator") {
    const { operation, a, b } = args || {};
    if (operation === "add") return a + b;
    if (operation === "subtract") return a - b;
    if (operation === "multiply") return a * b;
    if (operation === "divide") {
      if (b === 0) throw new Error("Cannot divide by zero");
      return a / b;
    }
    throw new Error(`Unknown calculator operation: ${operation}`);
  }

  if (name === "select_plan_template") {
    const { templateType = "standard", language = "en", includeAnimations = true } = args || {};
    const title = language === "zh" ? "Comprehensive Analysis (ZH)" : "Comprehensive Analysis";
    return [
      {
        title,
        focus: `${templateType} template`,
        animationType: includeAnimations ? "stats" : "none",
        agentType: "general",
      },
    ];
  }

  throw new Error(`Unknown tool: ${name}`);
}

function convertToOpenAITools(declarations) {
  return declarations.map((decl) => {
    const parameters = JSON.parse(JSON.stringify(decl.parameters));
    const lowercaseTypes = (obj) => {
      if (obj && obj.type && typeof obj.type === "string") {
        obj.type = obj.type.toLowerCase();
      }
      if (obj && obj.properties) {
        Object.keys(obj.properties).forEach((key) => lowercaseTypes(obj.properties[key]));
      }
      if (obj && obj.items) {
        lowercaseTypes(obj.items);
      }
    };
    lowercaseTypes(parameters);
    return {
      type: "function",
      function: {
        name: decl.name,
        description: decl.description,
        parameters,
      },
    };
  });
}

async function readOpenAIStream(response) {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  if (!reader) return { text: "", toolCalls: [] };

  let buffer = "";
  let text = "";
  const toolCalls = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line === "data: [DONE]" || !line.startsWith("data: ")) continue;
      try {
        const data = JSON.parse(line.slice(6));
        const delta = data?.choices?.[0]?.delta || {};
        if (typeof delta.content === "string") {
          text += delta.content;
        }
        if (Array.isArray(delta.tool_calls)) {
          for (const tc of delta.tool_calls) {
            if (!toolCalls[tc.index]) {
              toolCalls[tc.index] = {
                id: tc.id,
                function: { name: tc.function?.name || "", arguments: "" },
              };
            }
            if (tc.function?.arguments) {
              toolCalls[tc.index].function.arguments += tc.function.arguments;
            }
          }
        }
      } catch {
        // ignore partial chunks
      }
    }
  }

  return { text, toolCalls: toolCalls.filter(Boolean) };
}

async function openAICompatibleProbe({
  endpoint,
  apiKey,
  model,
  probe,
  preferManual,
}) {
  const declaration = TOOL_DECLARATIONS[probe.expectedSkill];
  const openAITools = convertToOpenAITools([declaration]);
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const makeBody = (manual) => {
    const basePrompt = probe.prompt;
    const manualPrompt = `${basePrompt}\n\n[SYSTEM WARNING: You are running in an environment that requires manual tool calling. You have access to the following tools:\n${JSON.stringify(openAITools, null, 2)}\nIf you need to use a tool, you MUST output exactly:\n<tool_call>{\"name\":\"tool_name\",\"arguments\":{}}</tool_call>]`;
    return {
      model,
      messages: [{ role: "user", content: manual ? manualPrompt : basePrompt }],
      stream: true,
      ...(manual ? {} : { tools: openAITools }),
    };
  };

  const tryRequest = async (manual) => {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(makeBody(manual)),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return {
          ok: false,
          status: response.status,
          error: String(err?.error?.message || `HTTP ${response.status}`),
        };
      }
      const parsed = await readOpenAIStream(response);
      return { ok: true, ...parsed };
    } catch (err) {
      return {
        ok: false,
        status: 0,
        error: err?.message || String(err),
      };
    }
  };

  let mode = preferManual ? "manual" : "native";
  let run = await tryRequest(mode === "manual");

  if (!preferManual && !run.ok) {
    const lower = String(run.error || "").toLowerCase();
    if (run.status === 400 && (lower.includes("tool") || lower.includes("function"))) {
      mode = "manual";
      run = await tryRequest(true);
    }
  }

  if (!run.ok) {
    return {
      passed: false,
      mode,
      usedSkill: null,
      error: run.error,
    };
  }

  if (mode === "native") {
    const first = run.toolCalls[0];
    if (!first?.function?.name) {
      return {
        passed: false,
        mode,
        usedSkill: null,
        error: "No native tool call captured",
      };
    }
    if (first.function.name !== probe.expectedSkill) {
      return {
        passed: false,
        mode,
        usedSkill: first.function.name,
        error: `Unexpected skill: ${first.function.name}`,
      };
    }
    try {
      const args = JSON.parse(first.function.arguments || "{}");
      executeLocalTool(first.function.name, args);
      return {
        passed: true,
        mode,
        usedSkill: first.function.name,
        error: null,
      };
    } catch (err) {
      return {
        passed: false,
        mode,
        usedSkill: first.function.name,
        error: `Tool execution failed: ${err?.message || String(err)}`,
      };
    }
  }

  const manualMatch = run.text.match(/<tool_call>([\s\S]*?)<\/tool_call>/);
  if (!manualMatch) {
    return {
      passed: false,
      mode,
      usedSkill: null,
      error: "No manual <tool_call> captured",
    };
  }

  try {
    const call = JSON.parse(manualMatch[1].replace(/```json/g, "").replace(/```/g, "").trim());
    if (call?.name !== probe.expectedSkill) {
      return {
        passed: false,
        mode,
        usedSkill: call?.name || null,
        error: `Unexpected skill: ${call?.name}`,
      };
    }
    executeLocalTool(call.name, call.arguments || {});
    return {
      passed: true,
      mode,
      usedSkill: call.name,
      error: null,
    };
  } catch (err) {
    return {
      passed: false,
      mode,
      usedSkill: null,
      error: `Manual tool call parse/execute failed: ${err?.message || String(err)}`,
    };
  }
}

async function geminiProbe({ apiKey, model, probe }) {
  if (!apiKey) {
    return {
      passed: false,
      mode: "native",
      usedSkill: null,
      error: "missing GEMINI_API_KEY",
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const declaration = TOOL_DECLARATIONS[probe.expectedSkill];
    const chat = ai.chats.create({
      model,
      config: {
        tools: [{ functionDeclarations: [declaration] }],
      },
    });

    const stream = await chat.sendMessageStream({ message: probe.prompt });
    let foundCall = null;
    for await (const chunk of stream) {
      if (Array.isArray(chunk.functionCalls) && chunk.functionCalls.length > 0) {
        foundCall = chunk.functionCalls[0];
        break;
      }
    }

    if (!foundCall?.name) {
      return {
        passed: false,
        mode: "native",
        usedSkill: null,
        error: "No function call captured",
      };
    }
    if (foundCall.name !== probe.expectedSkill) {
      return {
        passed: false,
        mode: "native",
        usedSkill: foundCall.name,
        error: `Unexpected skill: ${foundCall.name}`,
      };
    }
    executeLocalTool(foundCall.name, foundCall.args || {});
    return {
      passed: true,
      mode: "native",
      usedSkill: foundCall.name,
      error: null,
    };
  } catch (err) {
    return {
      passed: false,
      mode: "native",
      usedSkill: null,
      error: err?.message || String(err),
    };
  }
}

function printUsage() {
  console.log(
    [
      "Usage:",
      "  node scripts/verifyToolCalls.mjs [--cases provider:model,...] [--openai-base-url URL] [--dry-run]",
      "",
      "Examples:",
      "  node scripts/verifyToolCalls.mjs --cases deepseek:deepseek-chat,deepseek:deepseek-reasoner",
      "  node scripts/verifyToolCalls.mjs --cases openai_compatible:gpt-4o-mini --openai-base-url https://api.openai.com/v1",
      "",
      "Credential env vars:",
      "  DEEPSEEK_API_KEY",
      "  GEMINI_API_KEY",
      "  OPENAI_API_KEY (or OPENAI_COMPATIBLE_API_KEY)",
      "  OPENAI_BASE_URL (optional)",
    ].join("\n"),
  );
}

async function main() {
  if (hasFlag("help") || hasFlag("h")) {
    printUsage();
    return;
  }

  const casesArg = getArgValue("cases");
  const modelCases = casesArg ? parseCasesArg(casesArg) : buildDefaultCases();
  if (modelCases.length === 0) {
    console.error(
      "No model cases found. Provide --cases or set env vars (DEEPSEEK_API_KEY / GEMINI_API_KEY / OPENAI_API_KEY).",
    );
    process.exitCode = 1;
    return;
  }

  const dryRun = hasFlag("dry-run");
  const openAIBaseUrl = resolveOpenAIBaseUrl().replace(/\/+$/, "");
  const openAIApiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_COMPATIBLE_API_KEY || "";
  const deepseekApiKey = process.env.DEEPSEEK_API_KEY || "";
  const geminiApiKey = process.env.GEMINI_API_KEY || "";

  console.log("Tool-call diagnostic started.");
  console.log(`Model cases: ${modelCases.map((m) => m.label).join(", ")}`);
  console.log(`Probes: ${PROBES.map((p) => p.id).join(", ")}`);
  console.log("");

  let hasFailures = false;

  for (const modelCase of modelCases) {
    console.log(`=== ${modelCase.label} ===`);

    for (const probe of PROBES) {
      if (dryRun) {
        console.log(`DRY-RUN [${probe.id}] skip network`);
        continue;
      }

      let result;
      if (modelCase.provider === "gemini") {
        result = await geminiProbe({
          apiKey: geminiApiKey,
          model: modelCase.model,
          probe,
        });
      } else if (modelCase.provider === "deepseek") {
        result = await openAICompatibleProbe({
          endpoint: "https://api.deepseek.com/chat/completions",
          apiKey: deepseekApiKey,
          model: modelCase.model,
          probe,
          preferManual: reasonerLikely(modelCase.model),
        });
      } else {
        result = await openAICompatibleProbe({
          endpoint: `${openAIBaseUrl}/chat/completions`,
          apiKey: openAIApiKey,
          model: modelCase.model,
          probe,
          preferManual: reasonerLikely(modelCase.model),
        });
      }

      const passLabel = result.passed ? "PASS" : "FAIL";
      const skillLabel = result.usedSkill || "none";
      console.log(`${passLabel} [${probe.id}] mode=${result.mode} skill=${skillLabel}`);
      if (result.error) {
        console.log(`  error: ${result.error}`);
      }
      if (!result.passed) hasFailures = true;
    }

    console.log("");
  }

  if (hasFailures) {
    console.log("Diagnostic finished with failures.");
    process.exitCode = 1;
    return;
  }
  console.log("Diagnostic finished successfully.");
}

main().catch((err) => {
  console.error("Diagnostic crashed:", err);
  process.exitCode = 1;
});
