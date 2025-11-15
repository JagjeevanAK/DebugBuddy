import * as vscode from 'vscode';
import { getApiKey } from '../lib/getapi';
import { getModel } from '../lib/getmodel';

export const setApiKey = vscode.commands.registerCommand('DebugBuddy.setApiKey', async () => {

    const options = [
        "Anthropic",
        "Gemini",
        "Groq",
        "OpenAI",
        "Xai"
    ];
    const selection = await vscode.window.showQuickPick(options, {
        placeHolder: "Select the provider",
    });

    if (!selection) {
        vscode.window.showWarningMessage("API provider selection cancelled.");
        return;
    } else {
        await vscode.workspace.getConfiguration('DebugBuddy').update('model', selection, vscode.ConfigurationTarget.Global);
    }

    const apikey = await vscode.window.showInputBox({
        prompt: `Enter your API key of ${selection}`,
        placeHolder: "Enter your API Key",
        password: true,
        validateInput: (value) => {
            if (!value || value.trim() === '') {
                return 'API key cannot be empty';
            }
            if (value.length < 20) {
                return 'API key must be at least 20 characters long';
            }
            return null;
        }
    });
    if (apikey) {
        await vscode.workspace.getConfiguration('DebugBuddy').update('apiKey', apikey, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage('API key stored successfully!');
    } else {
        vscode.window.showErrorMessage('API key input was cancelled or is invalid.');
    }
});