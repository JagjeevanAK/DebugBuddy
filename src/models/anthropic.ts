import { createAnthropic } from '@ai-sdk/anthropic';
import { ProcessedPrompt } from "../prompt/types";
import { executeProvider, ProviderResponse } from './baseProvider';

export const anthropicTool = async (prompt: object | ProcessedPrompt | string): Promise<ProviderResponse> => {
    return executeProvider(prompt, {
        name: 'Anthropic',
        createClient: (apiKey: string) => createAnthropic({ apiKey })
    });
};