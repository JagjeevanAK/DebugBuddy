import { getTool, ProviderResponse } from "../models";
import { getModel } from "./config";
import { PromptManager } from "../prompt/PromptManager";
import { UserAction, CodeContext } from "../prompt/types";

export const processWithPrompt = async (
    action: UserAction,
    codeContext: CodeContext
): Promise<ProviderResponse> => {
    const promptManager = PromptManager.getInstance();
    const processedPrompt = await promptManager.processRequest(action, codeContext);
    const response = await getTool.provider(String(getModel()), processedPrompt.content);
    return response;
};

export const modelHoverResWithPrompt = async (codeContext: CodeContext): Promise<ProviderResponse> => {
    return processWithPrompt(UserAction.DEBUG_ERROR, codeContext);
};

export const modelFileReviewWithPrompt = async (codeContext: CodeContext): Promise<ProviderResponse> => {
    return processWithPrompt(UserAction.CODE_REVIEW, codeContext);
};
