import { createGroq } from '@ai-sdk/groq';
import { ProcessedPrompt } from "../prompt/types";
import { executeProvider, ProviderResponse } from './baseProvider';

export const groqTool = async (prompt: object | ProcessedPrompt | string): Promise<ProviderResponse> => {
    return executeProvider(prompt, {
        name: 'Groq',
        createClient: (apiKey: string) => createGroq({ apiKey })
    });
};