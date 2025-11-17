import { generateText } from "ai";
import { createXai } from '@ai-sdk/xai';
import { getApiKey, getCustomModel } from "../lib/config";
import { ProcessedPrompt, PromptMetadata } from "../prompt/types";

interface ProviderResponse {
    text: string;
    metadata?: PromptMetadata;
    promptType?: string;
}

export const xaiTool = async (prompt: object | ProcessedPrompt | string): Promise<ProviderResponse> => {
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

    try {
        const apiKey = getApiKey();
        if (!apiKey) {
            throw new Error('XAI API key not configured. Please set your API key using the "Set API Key" command.');
        }

        const customModel = getCustomModel();
        if (!customModel) {
            throw new Error('Custom model not specified. Please configure a model name for Xai.');
        }

        const xai = createXai({
            apiKey: String(apiKey),
        });

        const res = await generateText({
            model: xai(customModel as any),
            prompt: promptText
        });
        
        return {
            text: res.text,
            metadata,
            promptType
        };
    } catch (error) {
        console.error('XAI API error:', error);
        throw error;
    }
};