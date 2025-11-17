import { createOpenAI } from '@ai-sdk/openai';
import { ProcessedPrompt } from "../prompt/types";
import { executeProvider, ProviderResponse } from './baseProvider';

export const openrouterTool = async (prompt: object | ProcessedPrompt | string): Promise<ProviderResponse> => {
    return executeProvider(prompt, {
        name: 'OpenRouter',
        createClient: (apiKey: string) => createOpenAI({
            apiKey,
            baseURL: 'https://openrouter.ai/api/v1'
        })
    });
};
