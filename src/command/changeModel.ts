import * as vscode from 'vscode';
import { getApiKey, getModel } from '../lib/config';

export const changeModel = vscode.commands.registerCommand('DebugBuddy.changeModel', async () => {
    const currentApiKey = await getApiKey();
    
    if (!currentApiKey) {
        const action = await vscode.window.showWarningMessage(
            'No API Key found. Please set an API key first.',
            'Set API Key'
        );
        if (action === 'Set API Key') {
            vscode.commands.executeCommand('DebugBuddy.setApiKey');
        }
        return;
    }

    const currentProvider = getModel();
    
    const options = [
        "Anthropic",
        "Gemini",
        "Groq",
        "OpenAI",
        "OpenRouter",
        "Xai"
    ];

    const selection = await vscode.window.showQuickPick(options, {
        placeHolder: "Select the new provider",
        title: currentProvider ? `Current provider: ${currentProvider}` : "Select provider"
    });

    if (!selection) {
        vscode.window.showWarningMessage("Provider selection cancelled.");
        return;
    }

    await vscode.workspace.getConfiguration('DebugBuddy').update('model', selection, vscode.ConfigurationTarget.Global);

    const modelName = await vscode.window.showInputBox({
        prompt: `Enter the model name for ${selection}`,
        placeHolder: selection === "OpenAI" ? "e.g., gpt-4o, gpt-4o-mini" : 
                     selection === "Anthropic" ? "e.g., claude-3-5-sonnet-latest, claude-3-opus-latest" :
                     selection === "Gemini" ? "e.g., gemini-2.0-flash-exp, gemini-1.5-pro" :
                     selection === "Groq" ? "e.g., llama-3.3-70b-versatile, mixtral-8x7b-32768" :
                     selection === "Xai" ? "e.g., grok-beta" :
                     selection === "OpenRouter" ? "e.g., anthropic/claude-3.5-sonnet, openai/gpt-4o" :
                     "Enter model name",
        validateInput: (value) => {
            if (!value || value.trim() === '') {
                return 'Model name cannot be empty';
            }
            return null;
        }
    });

    if (modelName) {
        await vscode.workspace.getConfiguration('DebugBuddy').update('customModel', modelName, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Provider changed to '${selection}' with model '${modelName}'!`);
    } else {
        vscode.window.showErrorMessage('Model name input was cancelled or is invalid.');
    }
});
