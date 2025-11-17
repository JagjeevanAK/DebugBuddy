import * as vscode from 'vscode';
import {
	deleteKey,
	setApiKey,
	showApiKey,
	changeModel,
	reviewCode,
	performanceAnalysis,
	refactorSuggestions,
	securityAnalysis,
	analyzeWithDebugBuddy
} from "./command";
import {
	OnErrorHover
} from "./utils";
import { apiKeyCache } from "./lib/apiKeyCache";
import { configChangeHandler } from "./lib/configChangeHandler";
import { webviewManager } from "./webview/WebviewManager";
import { PromptManager } from "./prompt/PromptManager";

export async function activate(context: vscode.ExtensionContext) {

	console.log('Congratulations, your extension "DebugBuddy" is now active!');

	try {
		apiKeyCache.isInitialized();
		console.log('DebugBuddy: API key cache manager initialized successfully');
	} catch (error) {
		console.error('DebugBuddy: Error initializing API key cache manager:', error);
		console.log('DebugBuddy: Extension will continue with degraded caching functionality');
	}

	try {
		configChangeHandler.initialize();
		console.log('DebugBuddy: Configuration change listener registered successfully');
	} catch (error) {
		console.error('DebugBuddy: Error registering configuration change listener:', error);
		console.log('DebugBuddy: Extension will continue without automatic cache updates');
	}

	try {
		webviewManager.initialize(context);
		console.log('DebugBuddy: Webview manager initialized successfully');
	} catch (error) {
		console.error('DebugBuddy: Error initializing webview manager:', error);
		console.log('DebugBuddy: Extension will continue with terminal display fallback');
	}



	try {
		const promptManager = PromptManager.getInstance();
		await promptManager.initialize();
		console.log('DebugBuddy: Prompt manager initialized successfully');
	} catch (error) {
		console.error('DebugBuddy: Error initializing prompt manager:', error);
		console.log('DebugBuddy: Extension will continue with limited functionality');
	}

	context.subscriptions.push(
		deleteKey,
		OnErrorHover,
		reviewCode,
		performanceAnalysis,
		refactorSuggestions,
		securityAnalysis,
		analyzeWithDebugBuddy,
		setApiKey,
		showApiKey,
		changeModel,
		configChangeHandler,
		vscode.commands.registerCommand("DebugBuddy.showWebview", () => {
			webviewManager.toggleWebview();
		}),
		vscode.commands.registerCommand("DebugBuddy.hideWebview", () => {
			webviewManager.dispose();
		}),
		vscode.commands.registerCommand("DebugBuddy.refreshWebview", () => {
			webviewManager.refreshWebview();
		}),
		vscode.commands.registerCommand("DebugBuddy.clearWebview", () => {
			webviewManager.clearContent();
		}),
		vscode.commands.registerCommand("DebugBuddy.showWebviewHistory", () => {
			const history = webviewManager.getContentHistory();
			if (history.length === 0) {
				vscode.window.showInformationMessage('DebugBuddy: No webview history available');
				return;
			}
			
			const items = history.map((item, index) => ({
				label: `${item.fileName}`,
				description: `${item.timestamp}`,
				detail: `${item.content.substring(0, 100)}...`,
				index
			}));
			
			vscode.window.showQuickPick(items, {
				placeHolder: 'Select a previous AI response to view'
			}).then(selection => {
				if (selection) {
					const selectedContent = history[selection.index];
					webviewManager.displayResponse(selectedContent.content, selectedContent.fileName);
				}
			});
		}),
		vscode.commands.registerCommand("DebugBuddy.webviewHealthCheck", () => {
			const stats = webviewManager.getErrorStats();
			const healthStatus = webviewManager.getErrorStats().healthStatus || 'unknown';
			
			vscode.window.showInformationMessage(
				`DebugBuddy Webview Status: ${healthStatus}\nTotal errors: ${stats.totalErrors || 0}\nFallback usage: ${stats.fallbackUsageCount || 0}`,
				'Show Detailed Log',
				'Reset Webview'
			).then(selection => {
				if (selection === 'Show Detailed Log') {
					vscode.commands.executeCommand('DebugBuddy.showErrorLog');
				} else if (selection === 'Reset Webview') {
					webviewManager.dispose();
					webviewManager.initialize(context);
					vscode.window.showInformationMessage('DebugBuddy: Webview system reset successfully');
				}
			});
		}),
		vscode.commands.registerCommand("DebugBuddy.showErrorLog", () => {
			vscode.window.showInformationMessage('Error logging has been simplified. Check the Output panel for DebugBuddy logs.');
		}),

		vscode.commands.registerCommand("DebugBuddy.testPromptSystem", async () => {
			try {
				const promptManager = PromptManager.getInstance();
				const stats = promptManager.getStats();
				const availablePrompts = promptManager.getAvailablePromptTypes();
				
				vscode.window.showInformationMessage(
					`Prompt System Status:\nInitialized: ${stats.initialized}\nAvailable Prompts: ${availablePrompts.length}\nPrompts: ${availablePrompts.join(', ')}`,
					{ modal: true }
				);
			} catch (error) {
				vscode.window.showErrorMessage(`Prompt System Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
		})
	);
}

export function deactivate() {
	try {
		apiKeyCache.clear();
		console.log('DebugBuddy: API key cache cleared during deactivation');
	} catch (error) {
		console.error('DebugBuddy: Error clearing API key cache during deactivation:', error);
	}

	try {
		configChangeHandler.dispose();
		console.log('DebugBuddy: Configuration change handler disposed during deactivation');
	} catch (error) {
		console.error('DebugBuddy: Error disposing configuration change handler during deactivation:', error);
	}

	try {
		webviewManager.dispose();
		console.log('DebugBuddy: Webview manager disposed during deactivation');
	} catch (error) {
		console.error('DebugBuddy: Error disposing webview manager during deactivation:', error);
	}
}
