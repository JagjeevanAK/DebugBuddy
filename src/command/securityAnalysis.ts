import * as vscode from 'vscode';
import { analyzeFile } from '../helper/fileAnalysis';
import { UserAction } from '../prompt/types';

export const securityAnalysis = vscode.commands.registerCommand('DebugBuddy.analyzeSecurity', async () => {
    const activeEditor = vscode.window.activeTextEditor;

    if (!activeEditor) {
        vscode.window.showErrorMessage('No active file to analyze for security issues');
        return;
    }
    await analyzeFile(activeEditor, UserAction.SECURITY_ANALYSIS);
});
