import * as vscode from 'vscode';

export const setApiKey = vscode.commands.registerCommand('DebugBuddy.setApiKey', async () => {

    const options = [
        "Anthropic",
        "Gemini",
        "Groq",
        "OpenAI",
        "OpenRouter",
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
        return;
    }

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
        vscode.window.showInformationMessage(`Model '${modelName}' configured successfully!`);
    } else {
        vscode.window.showErrorMessage('Model name input was cancelled or is invalid.');
    }
});