import { vscode } from "./helper/vscode";
import {
	deleteKey,
	setApiKey,
	showApiKey,
	reviewCode
} from "./command";
import {
	OnErrorHover
} from "./extractors";
import { apiKeyCache } from "./lib/apiKeyCache";
import { configChangeHandler } from "./lib/configChangeHandler";
import { webviewManager } from "./webview/WebviewManager";
import { ConfigurationManager } from "./prompt/ConfigurationManager";
import { PromptManager } from "./prompt/PromptManager";

export async function activate(context: vscode.ExtensionContext) {

	console.log('Congratulations, your extension "DebugBuddy" is now active!');

	// Cache uses lazy initialization; accessing it will trigger initialization. Avoid eager setup to reduce startup impact.
	try {
		// Test cache initialization by checking if it's accessible
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
		const configManager = ConfigurationManager.getInstance();
		await configManager.migrateConfiguration();
		console.log('DebugBuddy: Configuration manager initialized and migrated successfully');
	} catch (error) {
		console.error('DebugBuddy: Error initializing configuration manager:', error);
		console.log('DebugBuddy: Extension will continue with default configuration');
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
		setApiKey,
		showApiKey,
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
			const { WebviewErrorLogger } = require('./webview/WebviewErrorLogger');
			const errorLogger = WebviewErrorLogger.getInstance();
			errorLogger.showErrorLog();
		}),
		vscode.commands.registerCommand("DebugBuddy.showPromptConfiguration", () => {
			const configManager = ConfigurationManager.getInstance();
			const summary = configManager.getConfigurationSummary();
			
			vscode.window.showInformationMessage(
				'DebugBuddy Prompt Configuration',
				'Show Details',
				'Reset to Defaults'
			).then(selection => {
				if (selection === 'Show Details') {
					vscode.window.showInformationMessage(summary, { modal: true });
				} else if (selection === 'Reset to Defaults') {
					vscode.window.showWarningMessage(
						'This will reset all prompt configuration to default values. Continue?',
						'Yes',
						'No'
					).then(async (confirm) => {
						if (confirm === 'Yes') {
							await configManager.resetToDefaults();
							vscode.window.showInformationMessage('DebugBuddy: Prompt configuration reset to defaults');
						}
					});
				}
			});
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
		}),
		vscode.commands.registerCommand("DebugBuddy.openPromptSettings", () => {
			// Open VS Code settings focused on DebugBuddy prompt settings
			vscode.commands.executeCommand('workbench.action.openSettings', 'DebugBuddy.prompts');
		}),
		vscode.commands.registerCommand("DebugBuddy.validatePromptConfiguration", async () => {
			try {
				const configManager = ConfigurationManager.getInstance();
				const validationResult = configManager.validateConfiguration();
				
				if (validationResult.isValid) {
					vscode.window.showInformationMessage(
						'DebugBuddy: Prompt configuration is valid!',
						'Show Details'
					).then(selection => {
						if (selection === 'Show Details') {
							const summary = configManager.getConfigurationSummary();
							vscode.window.showInformationMessage(summary, { modal: true });
						}
					});
				} else {
					const errorMessage = `Configuration validation failed:\n${validationResult.errors.join('\n')}`;
					const warningMessage = validationResult.warnings.length > 0 
						? `\n\nWarnings:\n${validationResult.warnings.join('\n')}` 
						: '';
					
					vscode.window.showErrorMessage(
						errorMessage + warningMessage,
						'Reset to Defaults',
						'Open Settings'
					).then(async (selection) => {
						if (selection === 'Reset to Defaults') {
							await configManager.resetToDefaults();
							vscode.window.showInformationMessage('DebugBuddy: Configuration reset to defaults');
						} else if (selection === 'Open Settings') {
							vscode.commands.executeCommand('workbench.action.openSettings', 'DebugBuddy.prompts');
						}
					});
				}
			} catch (error) {
				vscode.window.showErrorMessage(
					`DebugBuddy: Error validating configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
				);
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

	try {
		const configManager = ConfigurationManager.getInstance();
		configManager.dispose();
		console.log('DebugBuddy: Configuration manager disposed during deactivation');
	} catch (error) {
		console.error('DebugBuddy: Error disposing configuration manager during deactivation:', error);
	}
}
