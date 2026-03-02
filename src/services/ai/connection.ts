import { GoogleGenAI } from "@google/genai";
import { Capacitor } from "@capacitor/core";

function normalizeOpenAICompatibleBaseUrl(rawBaseUrl: string): string {
  const trimmed = String(rawBaseUrl || "").trim();
  if (!trimmed) return "";
  const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  return withProtocol.replace(/\/+$/, "");
}

export async function testConnection(settings: any): Promise<boolean> {
  try {
    if (settings.provider === "deepseek") {
      if (!settings.deepseekApiKey) {
        throw new Error("DeepSeek API Key is not configured.");
      }
      const response = await fetch(
        "https://api.deepseek.com/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${settings.deepseekApiKey}`,
          },
          body: JSON.stringify({
            model: settings.model || "deepseek-chat",
            messages: [{ role: "user", content: "Hello" }],
            max_tokens: 5,
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(
          err.error?.message || `HTTP error! status: ${response.status}`
        );
      }
      return true;
    } else if (settings.provider === "openai_compatible") {
      const baseUrl = normalizeOpenAICompatibleBaseUrl(
        settings.openaiCompatibleBaseUrl || ""
      );
      if (!baseUrl) {
        throw new Error("OpenAI-compatible base URL is not configured.");
      }

      const endpoint = `${baseUrl}/chat/completions`;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (settings.openaiCompatibleApiKey) {
        headers.Authorization = `Bearer ${settings.openaiCompatibleApiKey}`;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: settings.model || "gpt-4o-mini",
          messages: [{ role: "user", content: "Hello" }],
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(
          err.error?.message || `HTTP error! status: ${response.status}`,
        );
      }
      return true;
    } else {
      const apiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not defined");
      }
      const ai = new GoogleGenAI({ apiKey });
      await ai.models.generateContent({
        model: settings.model || "gemini-3-flash-preview",
        contents: "Hello",
      });
      return true;
    }
  } catch (e: any) {
    console.error("Connection test failed:", e);
    // Provide a more helpful message for Failed to fetch
    if (e.message === "Failed to fetch") {
      if (Capacitor.isNativePlatform()) {
        throw new Error(
          "Network request failed on native runtime. Check emulator internet/proxy/certificate, and run npx cap sync android after native network config changes."
        );
      }
      throw new Error(
        "Network request failed. Please check connectivity, endpoint URL, API key, or CORS settings."
      );
    }
    throw e;
  }
}
