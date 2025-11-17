import * as vscode from 'vscode';
import { analyzeFile } from '../utils/fileAnalysis';
import { UserAction } from '../prompt/types';

export const performanceAnalysis = vscode.commands.registerCommand('DebugBuddy.analyzePerformance', async () => {
    const activeEditor = vscode.window.activeTextEditor;

    if (!activeEditor) {
        vscode.window.showErrorMessage('No active file to analyze for performance');
        return;
    }
    await analyzeFile(activeEditor, UserAction.PERFORMANCE_ANALYSIS);
});
