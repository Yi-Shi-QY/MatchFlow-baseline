import { GoogleGenAI } from "@google/genai";
import { getSettings } from "../settings";

let aiInstance: GoogleGenAI | null = null;
let currentApiKey: string | null = null;

export function getGeminiAI(): GoogleGenAI {
  const settings = getSettings();
  const apiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined");
  }

  if (!aiInstance || currentApiKey !== apiKey) {
    aiInstance = new GoogleGenAI({ apiKey });
    currentApiKey = apiKey;
  }

  return aiInstance;
}
