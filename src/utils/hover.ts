import * as vscode from 'vscode';
import { getModelResponse } from "./modelResponse";

export const OnErrorHover = vscode.languages.registerHoverProvider('*', {
    async provideHover(document, position) {
        const diagnostics = vscode.languages.getDiagnostics(document.uri);

        const diagnostic = diagnostics.find(d => d.range.contains(position));

        if (diagnostic) {
            const markdown = new vscode.MarkdownString();
            markdown.appendMarkdown(`**Original Error:** ${diagnostic.message}\n\n`);
            markdown.appendMarkdown(`*Analyzing with code context...*`);

            const hoverInstance = new vscode.Hover(markdown);

            const aiRes = await getModelResponse({ diagnostic, uri: document.uri });

            if (aiRes) {
                const updatedMarkdown = new vscode.MarkdownString();
                updatedMarkdown.appendMarkdown(`**AI Analysis** *(with surrounding code context)*:\n\n${aiRes}`);
                updatedMarkdown.appendMarkdown(`\n\n----\n\n**Original Error:** ${diagnostic.message}`);

                return new vscode.Hover(updatedMarkdown);
            }

            return hoverInstance;
        }
        return null;
    }

});