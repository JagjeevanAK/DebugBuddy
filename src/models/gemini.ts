import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { ProcessedPrompt } from "../prompt/types";
import { executeProvider, ProviderResponse } from './baseProvider';

export const geminiTool = async (prompt: object | ProcessedPrompt | string): Promise<ProviderResponse> => {
    return executeProvider(prompt, {
        name: 'Gemini',
        createClient: (apiKey: string) => createGoogleGenerativeAI({ apiKey })
    });
};