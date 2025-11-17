import { anthropicTool } from "./anthropic";
import { geminiTool } from "./gemini";
import { groqTool } from "./groq";
import { openaiTool } from "./openai";
import { openrouterTool } from "./openrouter";
import { xaiTool } from "./xai";
import { ProviderResponse } from "./baseProvider";

export const getTool = {
    provider: (providerName: string, prompt: any): Promise<ProviderResponse> => {
        switch (providerName) {
            case "Anthropic":
                return anthropicTool(prompt);
            case "Gemini":
                return geminiTool(prompt);
            case "Groq":
                return groqTool(prompt);
            case "OpenAI":
                return openaiTool(prompt);
            case "OpenRouter":
                return openrouterTool(prompt);
            case "Xai":
                return xaiTool(prompt);
            default:
                throw new Error(`Unknown provider: ${providerName}`);
        }
    }
};

export type { ProviderResponse };