import { createXai } from '@ai-sdk/xai';
import { ProcessedPrompt } from "../prompt/types";
import { executeProvider, ProviderResponse } from './baseProvider';

export const xaiTool = async (prompt: object | ProcessedPrompt | string): Promise<ProviderResponse> => {
    return executeProvider(prompt, {
        name: 'XAI',
        createClient: (apiKey: string) => createXai({ apiKey })
    });
};