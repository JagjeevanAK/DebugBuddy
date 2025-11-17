import * as vscode from 'vscode';

type Data = {
    document: vscode.TextDocument
    diagnostic: vscode.Diagnostic
}

export const getErrorLine = (
    {document, diagnostic} : Data
) => {
    try {
        const lineIndex = diagnostic.range.start.line;
        const line = document.lineAt(lineIndex);

        return {
            number: lineIndex + 1,
            text: line.text,
            startChar: diagnostic.range.start.character,
            endChar: diagnostic.range.end.character,
            highlightedText: line.text.substring(
                diagnostic.range.start.character,
                diagnostic.range.end.character
            )
        };
    } catch (error) {
        console.log(error);
        return null;
    }
};