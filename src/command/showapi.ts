import * as vscode from 'vscode';
import { getApiKey } from '../lib/config';

export const showApiKey = vscode.commands.registerCommand('DebugBuddy.getApiKey', async () => {
    const apiKey = await getApiKey();

    if (apiKey) {
        vscode.window.showInformationMessage(`Current API Key : ${apiKey}`);
    } else {
        const action = await vscode.window.showWarningMessage(
            'Currently there is no API Key',
            'Set API Key'
        );
        if (action === 'Set API Key') {
            vscode.commands.executeCommand('DebugBuddy.setApiKey');
        }
    }
});