import * as vscode from 'vscode';

type Data = {
    document: vscode.TextDocument
    diagnostic: vscode.Diagnostic
}

export const getContextCode = (
    { document, diagnostic }: Data, 
    contextLines = 10
) => {
    const errorLine = diagnostic.range.start.line;
    const startLine = Math.max(0, errorLine - contextLines);
    const endLine = Math.min(document.lineCount - 1, errorLine + contextLines);

    const codeLines = [];

    for (let i = startLine; i <= endLine; i++) {
        try {
            const line = document.lineAt(i);
            codeLines.push({
                number: i + 1,
                text: line.text,
                isErrorLine: i === errorLine,
                prefix: i === errorLine ? '>>> ' : '    '
            });
        } catch (error) {
            console.log(error);
        }
    }

    return codeLines;
};
