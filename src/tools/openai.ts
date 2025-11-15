import { generateText } from "ai";
import { createOpenAI } from '@ai-sdk/openai';
import { getApiKey } from "../lib/getapi";
import { ProcessedPrompt, PromptMetadata } from "../prompt/types";

interface ProviderResponse {
    text: string;
    metadata?: PromptMetadata;
    promptType?: string;
}

export const openaiTool = async (prompt: object | ProcessedPrompt | string): Promise<ProviderResponse> => {
    let promptText: string;
    let metadata: PromptMetadata | undefined;
    let promptType: string | undefined;
    
    if (typeof prompt === 'string') {
        // Simple string prompt
        promptText = prompt;
    } else if (typeof prompt === 'object' && prompt !== null) {
        // Check if it's a ProcessedPrompt from the new system
        if ('content' in prompt && 'metadata' in prompt) {
            const processedPrompt = prompt as ProcessedPrompt;
            const content = processedPrompt.content as any;
            metadata = processedPrompt.metadata;
            
            // Extract prompt text from structured content
            if (content.instructions) {
                promptText = content.instructions;
                
                // Add context if available
                if (content.context && Object.keys(content.context).length > 0) {
                    promptText += '\n\nContext:\n' + JSON.stringify(content.context, null, 2);
                }
                
                // Add task information
                if (content.task) {
                    promptType = content.task;
                    promptText = `Task: ${content.task}\n\n${promptText}`;
                }
                
                // Add output format instructions
                if (content.output_format) {
                    promptText += '\n\nOutput Format:\n' + JSON.stringify(content.output_format, null, 2);
                }
            } else {
                // Fallback to serializing the entire content
                promptText = JSON.stringify(content, null, 2);
            }
        } else {
            // Fallback to JSON serialization for unknown formats
            promptText = JSON.stringify(prompt);
        }
    } else {
        promptText = String(prompt);
    }

    try {
        // Get API key dynamically for each request
        const apiKey = getApiKey();
        if (!apiKey) {
            throw new Error('OpenAI API key not configured. Please set your API key using the "Set API Key" command.');
        }

        const openai = createOpenAI({
            apiKey: String(apiKey),
            compatibility: 'strict',
        });

        const res = await generateText({
            model: openai("gpt-4o-mini"),
            prompt: promptText
        });
        
        return {
            text: res.text,
            metadata,
            promptType
        };
    } catch (error) {
        console.error('OpenAI API error:', error);
        throw error;
    }
};