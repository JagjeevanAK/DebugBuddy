import { getTool, ProviderResponse } from "../tools";
import { getModel } from "./getmodel";
import { PromptManager } from "../prompt/PromptManager";
import { UserAction, CodeContext } from "../prompt/types";

export const modelHoverResWithPrompt = async (
    codeContext: CodeContext
): Promise<ProviderResponse> => {
    const promptManager = PromptManager.getInstance();
    
    // Process the request using the debug analysis prompt
    const processedPrompt = await promptManager.processRequest(UserAction.DEBUG_ERROR, codeContext);
    
    // Use the processed prompt with the model
    const response = await getTool.provider(String(getModel()), processedPrompt.content);
    
    return response;
};