import * as vscode from 'vscode';
import { MarkdownRenderer } from './MarkdownRenderer';
import { HtmlTemplateSystem, TemplateData, TemplateOptions } from './HtmlTemplateSystem';
import { ThemeManager, ThemeConfiguration } from './ThemeManager';
import { WebviewErrorLogger } from './WebviewErrorLogger';

export interface IWebviewProvider {
    createWebview(): vscode.WebviewPanel;
    updateContent(content: string, fileName: string): void;
    dispose(): void;
    show(): void;
    setWebviewManager(manager: any): void;
}

export class WebviewProvider implements IWebviewProvider {
    private panel: vscode.WebviewPanel | undefined;
    private context: vscode.ExtensionContext;
    private markdownRenderer: MarkdownRenderer;
    private htmlTemplateSystem: HtmlTemplateSystem;
    private themeManager: ThemeManager;
    private static readonly viewType = 'DebugBuddyResponse';
    private webviewManager?: any; // Will be set by WebviewManager
    private themeChangeDisposable?: vscode.Disposable;
    private lastContent?: { content: string; fileName: string };
    private errorLogger: WebviewErrorLogger;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.markdownRenderer = new MarkdownRenderer();
        this.htmlTemplateSystem = new HtmlTemplateSystem();
        this.themeManager = new ThemeManager();
        this.errorLogger = WebviewErrorLogger.getInstance();
        
        // Set up theme change listener
        this.setupThemeChangeListener();
    }

    public setWebviewManager(manager: any): void {
        this.webviewManager = manager;
    }

    public createWebview(): vscode.WebviewPanel {
        try {
            // If panel already exists, return it
            if (this.panel) {
                return this.panel;
            }

            // Validate context before creating webview
            if (!this.context || !this.context.extensionUri) {
                throw new Error('Extension context is invalid or not available');
            }

            const config = vscode.workspace.getConfiguration('DebugBuddy');
            const webviewPosition = config.get<string>('webviewPosition', 'beside');
            const retainContext = config.get<boolean>('webviewRetainContext', true);
            
            // Map configuration to ViewColumn
            let viewColumn: vscode.ViewColumn;
            switch (webviewPosition) {
                case 'active':
                    viewColumn = vscode.ViewColumn.Active;
                    break;
                case 'one':
                    viewColumn = vscode.ViewColumn.One;
                    break;
                case 'two':
                    viewColumn = vscode.ViewColumn.Two;
                    break;
                case 'three':
                    viewColumn = vscode.ViewColumn.Three;
                    break;
                case 'beside':
                default:
                    viewColumn = vscode.ViewColumn.Beside;
            }

            this.panel = vscode.window.createWebviewPanel(
                WebviewProvider.viewType,
                'DebugBuddy AI Response',
                viewColumn,
                {
                    enableScripts: true,
                    retainContextWhenHidden: retainContext,
                    localResourceRoots: [
                        vscode.Uri.joinPath(this.context.extensionUri, 'resources')
                    ]
                }
            );

            // Validate that panel was created successfully
            if (!this.panel) {
                throw new Error('Failed to create webview panel - VS Code returned undefined');
            }

            this.panel.onDidDispose(() => {
                this.panel = undefined;
                // Notify WebviewManager of panel disposal
                if (this.webviewManager) {
                    this.webviewManager.setWebviewPanel(undefined);
                }
            }, null, this.context.subscriptions);

            // Notify WebviewManager of new panel
            if (this.webviewManager) {
                this.webviewManager.setWebviewPanel(this.panel);
            }

            return this.panel;
        } catch (error) {
            this.errorLogger.logError('createWebview', error as Error, false, {
                contextAvailable: !!this.context,
                extensionUriAvailable: !!(this.context?.extensionUri),
                panelExists: !!this.panel
            });
            throw error;
        }
    }

    public updateContent(content: string, fileName: string): void {
        try {
            // Validate input parameters
            if (typeof content !== 'string') {
                throw new Error('Content must be a string');
            }
            if (typeof fileName !== 'string' || fileName.trim().length === 0) {
                throw new Error('FileName must be a non-empty string');
            }

            if (!this.panel) {
                this.createWebview();
            }

            // Validate panel exists after creation attempt
            if (!this.panel) {
                throw new Error('Webview panel is not available after creation attempt');
            }

            // Store last content for theme updates
            this.lastContent = { content, fileName };

            // Validate webview object
            if (!this.panel.webview) {
                throw new Error('Webview object is not available on panel');
            }

            // Use enhanced markdown rendering with error handling
            const renderResult = this.markdownRenderer.renderWithErrorHandling(content);
            
            // Enhance template data with validation information
            const templateData: TemplateData = {
                fileName,
                timestamp: new Date().toLocaleString(),
                content: renderResult.html
            };
            
            const templateOptions: TemplateOptions = {
                title: renderResult.hasErrors ? 'DebugBuddy AI Response (with errors)' : 'DebugBuddy AI Response',
                enableScripts: true,
                themeConfiguration: this.themeManager.getCurrentTheme()
            };
            
            // Log rendering errors if any and enhance error display
            if (renderResult.hasErrors) {
                console.warn('DebugBuddy: Content rendering errors:', renderResult.errors);
                this.errorLogger.logError('renderMarkdown', new Error(renderResult.errors.join(', ')), false, {
                    fileName,
                    contentLength: content.length,
                    errorCount: renderResult.errors.length
                });
                
                // Show user notification for severe content errors
                if (renderResult.errors.some(error => error.includes('parsing error'))) {
                    vscode.window.showWarningMessage(
                        'DebugBuddy: Content parsing issues detected. Some formatting may not display correctly.',
                        'Show Error Details'
                    ).then(selection => {
                        if (selection === 'Show Error Details') {
                            this.errorLogger.showErrorLog();
                        }
                    });
                }
            }
            
            const html = this.htmlTemplateSystem.renderTemplate(templateData, templateOptions);
            
            // Validate HTML content before setting
            if (!html || html.trim().length === 0) {
                throw new Error('Generated HTML content is empty');
            }
            
            this.panel.webview.html = html;
        } catch (error) {
            this.errorLogger.logError('updateContent', error as Error, false, {
                fileName,
                contentLength: content?.length || 0,
                panelExists: !!this.panel,
                webviewExists: !!(this.panel?.webview),
                hasLastContent: !!this.lastContent
            });
            throw error;
        }
    }

    public show(): void {
        try {
            if (this.panel) {
                // Validate panel is still valid before revealing
                if (this.panel.visible !== undefined) {
                    this.panel.reveal(vscode.ViewColumn.Beside);
                } else {
                    // Panel seems to be disposed, create new one
                    this.panel = undefined;
                    this.createWebview();
                }
            } else {
                this.createWebview();
            }
        } catch (error) {
            this.errorLogger.logError('show', error as Error, false, {
                panelExists: !!this.panel,
                panelVisible: this.panel?.visible
            });
            throw error;
        }
    }

    public dispose(): void {
        if (this.panel) {
            this.panel.dispose();
            this.panel = undefined;
        }
        
        // Clean up theme change listener
        if (this.themeChangeDisposable) {
            this.themeChangeDisposable.dispose();
        }
        
        // Dispose theme manager and template system
        this.themeManager.dispose();
        this.htmlTemplateSystem.dispose();
    }

    private setupThemeChangeListener(): void {
        this.themeChangeDisposable = this.themeManager.onThemeChanged((newTheme: ThemeConfiguration) => {
            // Update webview content with new theme when theme changes
            if (this.panel && this.lastContent) {
                this.updateContent(this.lastContent.content, this.lastContent.fileName);
            }
        });
    }
}