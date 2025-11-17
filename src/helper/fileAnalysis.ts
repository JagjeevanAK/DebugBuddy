import { DebugBuddyOutputChannel } from "./cannel";
import { getLanguageFromExtension, getLanguageFromVSCode } from "./getlang";
import { displayReview } from "./terminalDisplay";
import { vscode } from "./vscode";
import { PromptManager } from "../prompt/PromptManager";
import { UserAction, CodeContext } from "../prompt/types";
import { getTool } from "../tools";
import { getModel } from "../lib/getmodel";

type TextEditor = typeof vscode.window.activeTextEditor;

export const analyzeFile = async (editor: TextEditor, action: UserAction) => {
    if (!editor) {
        vscode.window.showErrorMessage('DebugBuddy: No active editor found.');
        return;
    }

    const code = editor.document.getText();
    const fileName = editor.document.fileName;

    let fileLanguage = getLanguageFromExtension(fileName);

    if (fileLanguage === 'plaintext') {
        fileLanguage = getLanguageFromVSCode(editor);
    }

    const baseName = fileName.split('/').pop()?.toLowerCase() || '';
    if (fileLanguage === 'plaintext') {
        if (baseName === 'dockerfile') {
            fileLanguage = 'dockerfile';
        } else if (baseName === 'makefile') {
            fileLanguage = 'makefile';
        } else if (baseName === 'rakefile') {
            fileLanguage = 'ruby';
        } else if (baseName === 'gemfile') {
            fileLanguage = 'ruby';
        } else if (baseName === 'vagrantfile') {
            fileLanguage = 'ruby';
        } else if (baseName.startsWith('.env')) {
            fileLanguage = 'dotenv';
        }
    }

    const actionTitles: Record<UserAction, string> = {
        [UserAction.CODE_REVIEW]: 'reviewing',
        [UserAction.DEBUG_ERROR]: 'debugging',
        [UserAction.REFACTOR]: 'analyzing for refactoring',
        [UserAction.GENERATE_DOCS]: 'generating documentation',
        [UserAction.SECURITY_ANALYSIS]: 'analyzing security',
        [UserAction.PERFORMANCE_ANALYSIS]: 'analyzing performance',
        [UserAction.EXPLAIN_CODE]: 'explaining'
    };

    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `DebugBuddy is ${actionTitles[action]} your ${fileLanguage} code...`,
        cancellable: false
    }, async () => {
        try {
            const codeContext: CodeContext = {
                selectedText: code,
                fullText: code,
                filePath: fileName,
                language: fileLanguage
            };

            const promptManager = PromptManager.getInstance();
            const processedPrompt = await promptManager.processRequest(action, codeContext);

            const response = await getTool.provider(String(getModel()), processedPrompt.content);
            
            try {
                displayReview(response, fileName);
            } catch (displayError) {
                console.error('DebugBuddy: Error displaying analysis, using terminal display:', displayError);
                displayReview(response, fileName);
            }

        } catch (error) {
            console.error('Analysis error:', error);
            
            DebugBuddyOutputChannel.appendLine(`Failed to analyze ${fileLanguage} file: ${error}`);
            DebugBuddyOutputChannel.show(true);
            vscode.window.showErrorMessage('DebugBuddy: Failed to analyze code. Check your connection and API key.');
        }
    });
};
