import { getTool, ProviderResponse } from "../tools";
import { getModel } from "./getmodel";
import { PromptManager } from "../prompt/PromptManager";
import { UserAction, CodeContext } from "../prompt/types";

export const modelFileReviewWithPrompt = async (
    codeContext: CodeContext
): Promise<ProviderResponse> => {
    const promptManager = PromptManager.getInstance();

    // Process the request using the code review prompt
    const processedPrompt = await promptManager.processRequest(UserAction.CODE_REVIEW, codeContext);

    // Use the processed prompt with the model
    const response = await getTool.provider(String(getModel()), processedPrompt.content);

    return response;
};