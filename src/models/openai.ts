import { createOpenAI } from '@ai-sdk/openai';
import { ProcessedPrompt } from "../prompt/types";
import { executeProvider, ProviderResponse } from './baseProvider';

export const openaiTool = async (prompt: object | ProcessedPrompt | string): Promise<ProviderResponse> => {
    return executeProvider(prompt, {
        name: 'OpenAI',
        createClient: (apiKey: string) => createOpenAI({
            apiKey,
            compatibility: 'strict'
        })
    });
};