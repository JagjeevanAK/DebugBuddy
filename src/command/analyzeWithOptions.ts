import * as vscode from 'vscode';
import { analyzeFile } from '../utils/fileAnalysis';
import { UserAction } from '../prompt/types';
import { reviewFile } from '../utils/fileAnalysis';

export const analyzeWithDebugBuddy = vscode.commands.registerCommand('DebugBuddy.analyzeWithOptions', async () => {
    const activeEditor = vscode.window.activeTextEditor;

    if (!activeEditor) {
        vscode.window.showErrorMessage('No active file to analyze');
        return;
    }

    const options = [
        {
            label: '$(file-code) Code Review',
            description: 'Comprehensive code review with best practices',
            action: 'review'
        },
        {
            label: '$(dashboard) Performance Analysis',
            description: 'Identify bottlenecks and optimization opportunities',
            action: UserAction.PERFORMANCE_ANALYSIS
        },
        {
            label: '$(lightbulb) Refactoring Suggestions',
            description: 'Improve code maintainability and structure',
            action: UserAction.REFACTOR
        },
        {
            label: '$(shield) Security Analysis',
            description: 'Find vulnerabilities and security issues',
            action: UserAction.SECURITY_ANALYSIS
        }
    ];

    const selected = await vscode.window.showQuickPick(options, {
        placeHolder: 'Choose an analysis type',
        matchOnDescription: true
    });

    if (!selected) {
        return;
    }

    if (selected.action === 'review') {
        await reviewFile(activeEditor);
    } else {
        await analyzeFile(activeEditor, selected.action as UserAction);
    }
});
