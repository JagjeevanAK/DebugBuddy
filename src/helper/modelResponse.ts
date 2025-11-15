import { errorDetails } from "../extractors";
import { vscode } from "../helper/vscode";
import { modelHoverRes, modelHoverResWithPrompt } from "../lib/hoverResponse";
import { PromptManager } from "../prompt/PromptManager";
import { UserAction, CodeContext } from "../prompt/types";
import explanationCache from "./store";

type Param  = {
    diagnostic: vscode.Diagnostic
    uri: vscode.Uri
}

/**
 * Enhanced model response function that uses the new JSON prompt system
 * for error analysis and debugging assistance
 */
export const getModelResponse = async (
    { diagnostic, uri }: Param
) => {
    const key = `${uri.toString()}-${diagnostic.message}`;

    if (explanationCache.has(key)) {
        return explanationCache.get(key);
    }

    try {
        const errDetails = errorDetails({uri, diagnostic});

        if (errDetails) {
            const codeContext: CodeContext = {
                selectedText: errDetails.errorLine ? errDetails.errorLine.text : '',
                fullText: Array.isArray(errDetails.surroundingCode) 
                    ? errDetails.surroundingCode.map(line => line.text).join('\n')
                    : String(errDetails.surroundingCode || ''),
                filePath: errDetails.fileName,
                language: errDetails.fileLanguage,
                errorMessage: errDetails.errorMessage,
                lineNumber: errDetails.lineNumber,
                columnNumber: errDetails.columnNumber,
                surroundingCode: Array.isArray(errDetails.surroundingCode) 
                    ? errDetails.surroundingCode.map(line => line.text).join('\n')
                    : String(errDetails.surroundingCode || ''),
                diagnostics: [diagnostic]
            };

            // Use the enhanced hover response with prompt system
            const response = await modelHoverResWithPrompt(codeContext);
            
            // Cache the response
            // @ts-ignore
            const responseText = response.text || response.content || String(response);
            explanationCache.set(key, responseText);
            return responseText;
        }
    }
    catch (err) {
        console.error("Failed to get AI Explanation:", err);
        vscode.window.showErrorMessage('DebugBuddy: Failed to get AI explanation. Check your connection and API key.');
    }

    return null;
};