import * as vscode from 'vscode';
import { getModelResponse } from "./modelResponse";

export const OnErrorHover = vscode.languages.registerHoverProvider('*', {
    async provideHover(document, position) {
        const diagnostics = vscode.languages.getDiagnostics(document.uri);

        const diagnostic = diagnostics.find(d => d.range.contains(position));

        if (diagnostic) {
            // Use the enhanced model response that leverages the new prompt system
            const aiRes = await getModelResponse({ diagnostic, uri: document.uri });

            if (aiRes) {
                const markdown = new vscode.MarkdownString();

                markdown.appendMarkdown(`**AI Analysis:**\n\n ${aiRes}`);
                markdown.appendMarkdown(`\n\n----\n\n**Original Error:** ${diagnostic.message}`);

                return new vscode.Hover(markdown);
            }
        }
        return null;
    }

});