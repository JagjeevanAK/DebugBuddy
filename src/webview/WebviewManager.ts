import * as vscode from 'vscode';
import { WebviewProvider, IWebviewProvider } from './WebviewProvider';
import { ThemeManager } from './ThemeManager';
import { WebviewErrorLogger } from './WebviewErrorLogger';

export interface WebviewContent {
    fileName: string;
    timestamp: string;
    content: string;
    language?: string;
}

export interface WebviewState {
    isActive: boolean;
    panel?: vscode.WebviewPanel;
    lastContent?: WebviewContent;
    contentHistory: WebviewContent[];
}

export interface IWebviewManager {
    initialize(context: vscode.ExtensionContext): void;
    displayResponse(content: string, fileName: string): void;
    isWebviewActive(): boolean;
    toggleWebview(): void;
    updateContent(content: string, fileName: string, language?: string): void;
    clearContent(): void;
    getContentHistory(): WebviewContent[];
    refreshWebview(): void;
    refreshTheme(): void;
    dispose(): void;
    displayResponseWithFallback(content: string, fileName: string): void;
    getErrorStats(): any;
}

export class WebviewManager implements IWebviewManager {
    private webviewProvider: IWebviewProvider | undefined;
    private context: vscode.ExtensionContext | undefined;
    private state: WebviewState;
    private readonly maxHistorySize = 10;
    private errorLogger: WebviewErrorLogger;
    private fallbackEnabled: boolean = true;
    private hasShownFallbackNotification: boolean = false;

    constructor() {
        this.state = {
            isActive: false,
            contentHistory: []
        };
        this.errorLogger = WebviewErrorLogger.getInstance();
    }

    public initialize(context: vscode.ExtensionContext): void {
        try {
            this.context = context;
            this.webviewProvider = new WebviewProvider(context);
            this.state.isActive = true;
            
            // Set up bidirectional relationship
            this.webviewProvider.setWebviewManager(this);
            
            // Set up webview provider event handlers for state management
            this.setupWebviewProviderHandlers();
        } catch (error) {
            this.errorLogger.logError('initialize', error as Error, false, { context: 'WebviewManager initialization' });
            this.state.isActive = false;
            throw error;
        }
    }

    public displayResponse(content: string, fileName: string): void {
        if (!this.webviewProvider) {
            throw new Error('WebviewManager not initialized. Call initialize() first.');
        }

        try {
            this.updateContent(content, fileName);
            this.webviewProvider.show();
        } catch (error) {
            this.errorLogger.logError('displayResponse', error as Error, false, { fileName, contentLength: content.length });
            throw error;
        }
    }

    public displayResponseWithFallback(content: string, fileName: string): void {
        // Validate input content
        if (!content || content.trim().length === 0) {
            this.errorLogger.logError('displayResponseWithFallback', new Error('Empty or invalid content provided'), true, { fileName });
            this.fallbackToTerminal(content || 'No content available', fileName);
            return;
        }

        // Check if fallback should be used immediately
        if (!this.fallbackEnabled) {
            this.errorLogger.logError('displayResponseWithFallback', new Error('Fallback is disabled'), true, { fileName });
            this.fallbackToTerminal(content, fileName);
            return;
        }

        // Try webview display first with comprehensive error detection
        try {
            // Pre-flight checks
            if (!this.isWebviewActive()) {
                throw new Error('Webview is not active');
            }
            
            if (!this.webviewProvider) {
                throw new Error('WebviewProvider is not initialized');
            }

            if (!this.context) {
                throw new Error('Extension context is not available');
            }

            // Attempt to display in webview
            this.displayResponse(content, fileName);
            
            // Success - no need to log as this is the expected behavior

        } catch (error) {
            // Determine if this is a critical error that should disable webview temporarily
            const isCriticalError = this.isCriticalWebviewError(error as Error);
            
            if (isCriticalError) {
                this.temporarilyDisableWebview();
            }

            // Log error and use fallback
            this.errorLogger.logError('displayResponseWithFallback', error as Error, true, { 
                fileName, 
                contentLength: content.length,
                webviewActive: this.isWebviewActive(),
                contextAvailable: !!this.context,
                providerAvailable: !!this.webviewProvider,
                isCriticalError,
                errorType: (error as Error).constructor.name,
                errorMessage: (error as Error).message
            });
            
            this.fallbackToTerminal(content, fileName);
        }
    }

    public updateContent(content: string, fileName: string, language?: string): void {
        if (!this.webviewProvider) {
            throw new Error('WebviewManager not initialized. Call initialize() first.');
        }

        try {
            const webviewContent: WebviewContent = {
                fileName,
                timestamp: new Date().toISOString(),
                content,
                language
            };

            // Update state with new content
            this.state.lastContent = webviewContent;
            this.addToHistory(webviewContent);

            // Update webview provider
            this.webviewProvider.updateContent(content, fileName);
        } catch (error) {
            this.errorLogger.logError('updateContent', error as Error, false, { 
                fileName, 
                contentLength: content.length,
                language 
            });
            throw error;
        }
    }

    public isWebviewActive(): boolean {
        return this.state.isActive && this.webviewProvider !== undefined;
    }

    public toggleWebview(): void {
        if (!this.webviewProvider) {
            throw new Error('WebviewManager not initialized. Call initialize() first.');
        }

        try {
            if (this.state.panel) {
                // If webview exists, show it
                this.webviewProvider.show();
            } else {
                // Create new webview and show last content if available
                this.webviewProvider.show();
                if (this.state.lastContent) {
                    this.webviewProvider.updateContent(
                        this.state.lastContent.content, 
                        this.state.lastContent.fileName
                    );
                }
            }
        } catch (error) {
            this.errorLogger.logError('toggleWebview', error as Error, false, { 
                panelExists: !!this.state.panel,
                hasLastContent: !!this.state.lastContent
            });
            throw error;
        }
    }

    public clearContent(): void {
        if (!this.webviewProvider) {
            return;
        }

        // Clear current content
        this.webviewProvider.updateContent('', 'No file selected');
        
        // Reset state
        this.state.lastContent = undefined;
    }

    public getContentHistory(): WebviewContent[] {
        return [...this.state.contentHistory];
    }

    public refreshWebview(): void {
        if (!this.webviewProvider || !this.state.lastContent) {
            return;
        }

        // Refresh with last content
        this.webviewProvider.updateContent(
            this.state.lastContent.content,
            this.state.lastContent.fileName
        );
    }

    public refreshTheme(): void {
        // Force a theme refresh by updating content
        this.refreshWebview();
    }

    public dispose(): void {
        if (this.webviewProvider) {
            this.webviewProvider.dispose();
        }
        
        // Reset state
        this.state = {
            isActive: false,
            contentHistory: []
        };
    }

    public getErrorStats(): any {
        return this.errorLogger.getErrorStats();
    }

    private fallbackToTerminal(content: string, fileName: string): void {
        try {
            // Log fallback usage
            console.warn('DebugBuddy: Using terminal fallback for content display');
            
            // Direct terminal display without calling displayReview to avoid circular dependency
            const { DebugBuddyOutputChannel } = require('../helper/cannel');
            
            DebugBuddyOutputChannel.clear();
            DebugBuddyOutputChannel.appendLine('DebugBuddy Code Review\n');
            DebugBuddyOutputChannel.appendLine(`File: ${fileName}`);
            DebugBuddyOutputChannel.appendLine(`Analyzed: ${new Date().toLocaleString()}\n`);
            DebugBuddyOutputChannel.appendLine('---\n');
            DebugBuddyOutputChannel.appendLine(content);
            DebugBuddyOutputChannel.appendLine('\n---');
            DebugBuddyOutputChannel.appendLine('\nNote: Displayed in terminal due to webview issues. Check error log for details.');
            DebugBuddyOutputChannel.show(true);
            
            // Show user notification about fallback (only once per session)
            if (!this.hasShownFallbackNotification) {
                this.hasShownFallbackNotification = true;
                vscode.window.showWarningMessage(
                    'DebugBuddy: Using terminal display due to webview issues. Check the error log for details.',
                    'Show Error Log',
                    'Don\'t Show Again'
                ).then(selection => {
                    if (selection === 'Show Error Log') {
                        this.errorLogger.showErrorLog();
                    } else if (selection === 'Don\'t Show Again') {
                        this.hasShownFallbackNotification = true;
                    }
                });
            }
            
        } catch (terminalError) {
            // If even terminal display fails, log it but don't throw
            this.errorLogger.logError('fallbackToTerminal', terminalError as Error, false, { 
                fileName,
                originalContent: content.substring(0, 100) + '...' // Log first 100 chars
            });
            
            // Show a critical error message to user
            vscode.window.showErrorMessage(
                'DebugBuddy: Failed to display response in both webview and terminal. Check the output panel for details.',
                'Show Error Log',
                'Reset Extension'
            ).then(selection => {
                if (selection === 'Show Error Log') {
                    this.errorLogger.showErrorLog();
                } else if (selection === 'Reset Extension') {
                    this.resetWebviewSystem();
                }
            });
        }
    }

    private isCriticalWebviewError(error: Error): boolean {
        const criticalErrorPatterns = [
            'Extension context is invalid',
            'VS Code returned undefined',
            'Webview object is not available',
            'Failed to create webview panel',
            'Extension host connection lost'
        ];
        
        return criticalErrorPatterns.some(pattern => 
            error.message.toLowerCase().includes(pattern.toLowerCase())
        );
    }

    private temporarilyDisableWebview(): void {
        console.warn('DebugBuddy: Temporarily disabling webview due to critical error');
        this.fallbackEnabled = false;
        
        // Re-enable after 30 seconds
        setTimeout(() => {
            this.fallbackEnabled = true;
            console.log('DebugBuddy: Webview re-enabled after temporary disable');
        }, 30000);
    }

    private resetWebviewSystem(): void {
        try {
            // Dispose current webview system
            this.dispose();
            
            // Reset state
            this.fallbackEnabled = true;
            this.hasShownFallbackNotification = false;
            
            // Reinitialize if context is available
            if (this.context) {
                this.initialize(this.context);
            }
            
            vscode.window.showInformationMessage('DebugBuddy: Webview system has been reset');
        } catch (resetError) {
            this.errorLogger.logError('resetWebviewSystem', resetError as Error, false, {});
            vscode.window.showErrorMessage('DebugBuddy: Failed to reset webview system');
        }
    }

    private setupWebviewProviderHandlers(): void {
        // This method sets up event handlers to keep state in sync
        // The actual panel reference will be managed by the provider
        // but we track the state here for coordination
    }

    private addToHistory(content: WebviewContent): void {
        // Add to beginning of history
        this.state.contentHistory.unshift(content);
        
        // Limit history size
        if (this.state.contentHistory.length > this.maxHistorySize) {
            this.state.contentHistory = this.state.contentHistory.slice(0, this.maxHistorySize);
        }
    }

    // Method to get webview panel reference for advanced operations
    public getWebviewPanel(): vscode.WebviewPanel | undefined {
        return this.state.panel;
    }

    // Method to set panel reference (called by WebviewProvider)
    public setWebviewPanel(panel: vscode.WebviewPanel | undefined): void {
        this.state.panel = panel;
        this.state.isActive = panel !== undefined;
    }
}

export const webviewManager = new WebviewManager();