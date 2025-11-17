import * as vscode from 'vscode';
import { analyzeFile } from '../utils/fileAnalysis';
import { UserAction } from '../prompt/types';

export const refactorSuggestions = vscode.commands.registerCommand('DebugBuddy.suggestRefactoring', async () => {
    const activeEditor = vscode.window.activeTextEditor;

    if (!activeEditor) {
        vscode.window.showErrorMessage('No active file to refactor');
        return;
    }
    await analyzeFile(activeEditor, UserAction.REFACTOR);
});
