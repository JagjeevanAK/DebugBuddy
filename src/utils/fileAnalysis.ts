import * as vscode from 'vscode';
import { DebugBuddyOutputChannel } from "./cannel";
import { getLanguageFromExtension, getLanguageFromVSCode } from "./getlang";
import { displayReview } from "./terminalDisplay";
import { PromptManager } from "../prompt/PromptManager";
import { modelFileReviewWithPrompt } from "../lib/aiService";
import { UserAction, CodeContext } from "../prompt/types";
import { getTool } from "../models";
import { getModel } from "../lib/config";

type TextEditor = typeof vscode.window.activeTextEditor;

const detectLanguage = (fileName: string, editor: NonNullable<TextEditor>): string => {
    let fileLanguage = getLanguageFromExtension(fileName);

    if (fileLanguage === 'plaintext') {
        fileLanguage = getLanguageFromVSCode(editor);
    }

    const baseName = fileName.split('/').pop()?.toLowerCase() || '';
    if (fileLanguage === 'plaintext') {
        const specialFiles: Record<string, string> = {
            'dockerfile': 'dockerfile',
            'makefile': 'makefile',
            'rakefile': 'ruby',
            'gemfile': 'ruby',
            'vagrantfile': 'ruby'
        };
        
        fileLanguage = specialFiles[baseName] || (baseName.startsWith('.env') ? 'dotenv' : 'plaintext');
    }

    return fileLanguage;
};

export const analyzeFile = async (editor: TextEditor, action: UserAction) => {
    if (!editor) {
        vscode.window.showErrorMessage('DebugBuddy: No active editor found.');
        return;
    }

    const code = editor.document.getText();
    const fileName = editor.document.fileName;
    const fileLanguage = detectLanguage(fileName, editor);

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
            
            displayReview(response, fileName);
        } catch (error) {
            console.error('Analysis error:', error);
            DebugBuddyOutputChannel.appendLine(`Failed to analyze ${fileLanguage} file: ${error}`);
            DebugBuddyOutputChannel.show(true);
            vscode.window.showErrorMessage('DebugBuddy: Failed to analyze code. Check your connection and API key.');
        }
    });
};

export const reviewFile = async (editor: TextEditor) => {
    if (!editor) {
        vscode.window.showErrorMessage('DebugBuddy: No active editor found.');
        return;
    }

    const code = editor.document.getText();
    const fileName = editor.document.fileName;
    const fileLanguage = detectLanguage(fileName, editor);

    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `DebugBuddy is reviewing your ${fileLanguage} code...`,
        cancellable: false
    }, async () => {
        try {
            const codeContext: CodeContext = {
                selectedText: code,
                fullText: code,
                filePath: fileName,
                language: fileLanguage
            };

            const response = await modelFileReviewWithPrompt(codeContext);
            displayReview(response, fileName);
        } catch (error) {
            console.error('Code review error:', error);
            DebugBuddyOutputChannel.appendLine(`Failed to get code review for ${fileLanguage} file: ${error}`);
            DebugBuddyOutputChannel.show(true);
            vscode.window.showErrorMessage('DebugBuddy: Failed to get code review. Check your connection and API key.');
        }
    });
};
