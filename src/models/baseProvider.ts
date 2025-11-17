import { generateText } from "ai";
import { ProcessedPrompt, PromptMetadata } from "../prompt/types";
import { getApiKey, getCustomModel } from "../lib/config";

export interface ProviderResponse {
    text: string;
    metadata?: PromptMetadata;
    promptType?: string;
}

export interface ProviderConfig {
    name: string;
    createClient: (apiKey: string) => any;
    clientOptions?: Record<string, any>;
}

export function processPrompt(prompt: object | ProcessedPrompt | string): {
    promptText: string;
    metadata?: PromptMetadata;
    promptType?: string;
} {
    let promptText: string;
    let metadata: PromptMetadata | undefined;
    let promptType: string | undefined;
    
    if (typeof prompt === 'string') {
        promptText = prompt;
    } else if (typeof prompt === 'object' && prompt !== null) {
        if ('content' in prompt && 'metadata' in prompt) {
            const processedPrompt = prompt as ProcessedPrompt;
            const content = processedPrompt.content as any;
            metadata = processedPrompt.metadata;
            
            if (content.instructions) {
                promptText = content.instructions;
                
                if (content.context && Object.keys(content.context).length > 0) {
                    promptText += '\n\nContext:\n' + JSON.stringify(content.context, null, 2);
                }
                
                if (content.task) {
                    promptType = content.task;
                    promptText = `Task: ${content.task}\n\n${promptText}`;
                }
                
                if (content.output_format) {
                    promptText += '\n\nOutput Format:\n' + JSON.stringify(content.output_format, null, 2);
                }
            } else {
                promptText = JSON.stringify(content, null, 2);
            }
        } else {
            promptText = JSON.stringify(prompt);
        }
    } else {
        promptText = String(prompt);
    }

    return { promptText, metadata, promptType };
}

export async function executeProvider(
    prompt: object | ProcessedPrompt | string,
    config: ProviderConfig
): Promise<ProviderResponse> {
    const { promptText, metadata, promptType } = processPrompt(prompt);

    try {
        const apiKey = getApiKey();
        if (!apiKey) {
            throw new Error(`${config.name} API key not configured. Please set your API key using the "Set API Key" command.`);
        }

        const customModel = getCustomModel();
        if (!customModel) {
            throw new Error(`Custom model not specified. Please configure a model name for ${config.name}.`);
        }

        const client = config.createClient(String(apiKey));

        const res = await generateText({
            model: client(customModel as any),
            prompt: promptText
        });
        
        return {
            text: res.text,
            metadata,
            promptType
        };
    } catch (error) {
        console.error(`${config.name} API error:`, error);
        throw error;
    }
}
