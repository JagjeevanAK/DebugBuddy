import * as vscode from 'vscode';
import { DebugBuddyOutputChannel } from "./cannel";
import { webviewManager } from "../webview/WebviewManager";

export const displayReview = (reviewResponse: any, fileName: any, skipWebview: boolean = false) => {
    const config = vscode.workspace.getConfiguration('DebugBuddy');
    const useWebview = config.get<boolean>('useWebview', true);
    const autoShow = config.get<boolean>('webviewAutoShow', true);
    
    // Validate input parameters
    if (!reviewResponse || typeof reviewResponse.text !== 'string') {
        console.error('DebugBuddy: Invalid review response provided to displayReview');
        DebugBuddyOutputChannel.appendLine('Error: Invalid review response received');
        DebugBuddyOutputChannel.show(true);
        return;
    }

    if (!fileName || typeof fileName !== 'string') {
        console.error('DebugBuddy: Invalid fileName provided to displayReview');
        fileName = 'Unknown file';
    }

    // Try to use webview first if enabled and available (and not explicitly skipped)
    if (useWebview && autoShow && !skipWebview) {
        try {
            // Use the enhanced fallback mechanism
            webviewManager.displayResponseWithFallback(reviewResponse.text, fileName);
            return;
        } catch (error) {
            console.error('DebugBuddy: Failed to display in webview with fallback, using terminal:', error);
            // Fall through to terminal display
        }
    }

    // Terminal display (fallback or explicitly requested)
    try {
        DebugBuddyOutputChannel.clear();
        DebugBuddyOutputChannel.appendLine('DebugBuddy Code Review\n');
        DebugBuddyOutputChannel.appendLine(`File: ${fileName}`);
        DebugBuddyOutputChannel.appendLine(`Analyzed: ${new Date().toLocaleString()}\n`);
        DebugBuddyOutputChannel.appendLine('---\n');
        DebugBuddyOutputChannel.appendLine(reviewResponse.text);
        DebugBuddyOutputChannel.appendLine('\n---');
        
        if (useWebview && !skipWebview) {
            DebugBuddyOutputChannel.appendLine('\nNote: Displayed in terminal due to webview issues. Check error log for details.');
        }

        DebugBuddyOutputChannel.show(true);
    } catch (terminalError) {
        console.error('DebugBuddy: Critical error - even terminal display failed:', terminalError);
        // Last resort: show error message
        const vscode = require('vscode');
        vscode.window.showErrorMessage(
            'DebugBuddy: Critical display error. Unable to show review results.',
            'Show in New Document'
        ).then((selection: string) => {
            if (selection === 'Show in New Document') {
                vscode.workspace.openTextDocument({
                    content: `DebugBuddy Code Review\n\nFile: ${fileName}\nAnalyzed: ${new Date().toLocaleString()}\n\n${reviewResponse.text}`,
                    language: 'markdown'
                }).then((doc: any) => {
                    vscode.window.showTextDocument(doc);
                });
            }
        });
    }
};