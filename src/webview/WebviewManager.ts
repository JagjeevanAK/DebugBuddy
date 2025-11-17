import * as vscode from 'vscode';
import { MarkdownRenderer } from './MarkdownRenderer';

interface WebviewContent {
    fileName: string;
    timestamp: string;
    content: string;
}

export class WebviewManager {
    private panel?: vscode.WebviewPanel;
    private context?: vscode.ExtensionContext;
    private contentHistory: WebviewContent[] = [];
    private readonly maxHistorySize = 10;
    private renderer: MarkdownRenderer;

    constructor() {
        this.renderer = new MarkdownRenderer();
    }

    public initialize(context: vscode.ExtensionContext): void {
        this.context = context;
    }

    public displayResponseWithFallback(content: string, fileName: string): void {
        if (!content?.trim()) {
            this.fallbackToTerminal('No content available', fileName);
            return;
        }

        try {
            this.displayResponse(content, fileName);
        } catch (error) {
            console.error('Webview display failed:', error);
            this.fallbackToTerminal(content, fileName);
        }
    }

    public displayResponse(content: string, fileName: string): void {
        const timestamp = new Date().toLocaleString();
        
        this.addToHistory({ fileName, timestamp, content });
        
        if (!this.panel) {
            this.createPanel();
        }

        const html = this.generateHtml(content, fileName, timestamp);
        if (this.panel) {
            this.panel.webview.html = html;
            this.panel.reveal(vscode.ViewColumn.Beside);
        }
    }

    private createPanel(): void {
        if (!this.context) {
            throw new Error('WebviewManager not initialized');
        }

        this.panel = vscode.window.createWebviewPanel(
            'debugBuddyResponse',
            'DebugBuddy',
            vscode.ViewColumn.Beside,
            {
                enableScripts: false,
                retainContextWhenHidden: true
            }
        );

        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });
    }

    private generateHtml(content: string, fileName: string, timestamp: string): string {
        const theme = vscode.window.activeColorTheme;
        const isDark = theme.kind === vscode.ColorThemeKind.Dark;
        
        const renderedContent = this.renderer.renderMarkdown(content);

        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            line-height: 1.6;
        }
        .header {
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 15px;
            margin-bottom: 20px;
        }
        h1 {
            margin: 0 0 10px 0;
            font-size: 1.5em;
            color: var(--vscode-titleBar-activeForeground);
        }
        .file-info {
            color: var(--vscode-descriptionForeground);
            font-size: 0.9em;
        }
        .filename {
            font-weight: bold;
            margin-right: 15px;
        }
        .content {
            max-width: 900px;
        }
        pre {
            background-color: ${isDark ? '#0d1117' : '#f6f8fa'};
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 16px;
            overflow-x: auto;
        }
        code {
            font-family: var(--vscode-editor-font-family);
            font-size: 0.9em;
            background-color: ${isDark ? '#161b22' : '#f0f0f0'};
            padding: 2px 6px;
            border-radius: 3px;
        }
        pre code {
            background: none;
            padding: 0;
        }
        h2, h3, h4 {
            color: var(--vscode-titleBar-activeForeground);
            margin-top: 24px;
            margin-bottom: 12px;
        }
        ul, ol {
            padding-left: 30px;
        }
        li {
            margin-bottom: 8px;
        }
        a {
            color: var(--vscode-textLink-foreground);
        }
        a:hover {
            color: var(--vscode-textLink-activeForeground);
        }
        blockquote {
            border-left: 4px solid var(--vscode-textBlockQuote-border);
            padding-left: 16px;
            margin-left: 0;
            color: var(--vscode-textBlockQuote-foreground);
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>DebugBuddy Analysis</h1>
        <div class="file-info">
            <span class="filename">${this.escapeHtml(fileName)}</span>
            <span class="timestamp">${this.escapeHtml(timestamp)}</span>
        </div>
    </div>
    <div class="content">
        ${renderedContent}
    </div>
</body>
</html>`;
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    private fallbackToTerminal(content: string, fileName: string): void {
        const { DebugBuddyOutputChannel } = require('../utils/cannel');
        
        DebugBuddyOutputChannel.clear();
        DebugBuddyOutputChannel.appendLine(`\n${'='.repeat(80)}`);
        DebugBuddyOutputChannel.appendLine(`DebugBuddy Analysis - ${fileName}`);
        DebugBuddyOutputChannel.appendLine(`${new Date().toLocaleString()}`);
        DebugBuddyOutputChannel.appendLine('='.repeat(80));
        DebugBuddyOutputChannel.appendLine('');
        DebugBuddyOutputChannel.appendLine(content);
        DebugBuddyOutputChannel.appendLine('');
        DebugBuddyOutputChannel.show(true);
    }

    private addToHistory(content: WebviewContent): void {
        this.contentHistory.unshift(content);
        if (this.contentHistory.length > this.maxHistorySize) {
            this.contentHistory = this.contentHistory.slice(0, this.maxHistorySize);
        }
    }

    public toggleWebview(): void {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.Beside);
        } else {
            vscode.window.showInformationMessage('No content to display yet');
        }
    }

    public refreshWebview(): void {
        const lastContent = this.contentHistory[0];
        if (lastContent) {
            this.displayResponse(lastContent.content, lastContent.fileName);
        }
    }

    public clearContent(): void {
        if (this.panel) {
            this.panel.webview.html = this.generateHtml('Content cleared', '', new Date().toLocaleString());
        }
    }

    public getContentHistory(): WebviewContent[] {
        return [...this.contentHistory];
    }

    public isWebviewActive(): boolean {
        return this.panel !== undefined;
    }

    public getErrorStats(): any {
        return {
            totalErrors: 0,
            fallbackUsageCount: 0,
            healthStatus: 'healthy'
        };
    }

    public dispose(): void {
        if (this.panel) {
            this.panel.dispose();
            this.panel = undefined;
        }
    }
}

export const webviewManager = new WebviewManager();
