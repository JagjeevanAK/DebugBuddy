import * as vscode from 'vscode';
import { getContextCode } from "./codeContext";
import { getErrorLine } from "./errorLine";

type Param = {
    diagnostic: vscode.Diagnostic
    uri: vscode.Uri
}

export const errorDetails = (
    {uri, diagnostic}: Param
) =>{
    const document = vscode.workspace.textDocuments.find(doc => doc.uri.toString() === uri.toString());

    if (!document) {
        return null;
    }

    const errorData = {
        errorMessage: diagnostic.message,
        errorSource: diagnostic.source,
        errorCode: diagnostic.code,
        errorSeverity: diagnostic.severity,
        fileName: document.fileName,
        fileLanguage: document.languageId,
        lineNumber: diagnostic.range.start.line + 1,
        columnNumber: diagnostic.range.start.character + 1,
        errorLine: getErrorLine({document, diagnostic}),
        surroundingCode: getContextCode({document, diagnostic}),
        timestamp: new Date().toISOString(),
        projectRoot: vscode.workspace.workspaceFolders?.[0]?.uri.path
    };

    return errorData;
};
