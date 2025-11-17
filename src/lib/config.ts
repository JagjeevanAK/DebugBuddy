import * as vscode from 'vscode';
import { apiKeyCache } from "./apiKeyCache";

export function getApiKey(): string | undefined {
    try {
        if (apiKeyCache.isInitialized()) {
            try {
                const cachedKey = apiKeyCache.get();
                return cachedKey;
            } catch (error) {
                console.error('DebugBuddy: Error retrieving API key from cache, falling back to direct VSCode query:', error);
            }
        }
        
        const apiKey = vscode.workspace.getConfiguration('DebugBuddy').get('apiKey') as string | undefined;
        
        try {
            apiKeyCache.set(apiKey);
        } catch (error) {
            console.error('DebugBuddy: Error updating API key cache, continuing with direct query result:', error);
        }
        
        return apiKey;
        
    } catch (error) {
        console.error('DebugBuddy: Critical error retrieving API key:', error);
        vscode.window.showErrorMessage('DebugBuddy: Failed to retrieve API key. Please check your settings.');
        return undefined;
    }
}

export function getModel(): string | undefined {
    return vscode.workspace.getConfiguration('DebugBuddy').get('model');
}

export function getCustomModel(): string | undefined {
    return vscode.workspace.getConfiguration('DebugBuddy').get('customModel');
}
