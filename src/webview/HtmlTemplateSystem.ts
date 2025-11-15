import { ThemeManager, ThemeConfiguration } from './ThemeManager';

export interface TemplateData {
    fileName: string;
    timestamp: string;
    content: string;
    language?: string;
}

export interface TemplateOptions {
    title?: string;
    enableScripts?: boolean;
    customStyles?: string;
    themeConfiguration?: ThemeConfiguration;
}

export interface IHtmlTemplateSystem {
    renderTemplate(data: TemplateData, options?: TemplateOptions): string;
    getBaseTemplate(): string;
    escapeHtml(text: string): string;
}

export class HtmlTemplateSystem implements IHtmlTemplateSystem {
    private readonly defaultTitle = 'DebugBuddy AI Response';
    private themeManager: ThemeManager;
    
    constructor() {
        this.themeManager = new ThemeManager();
    }
    
    public renderTemplate(data: TemplateData, options: TemplateOptions = {}): string {
        const title = options.title || this.defaultTitle;
        const enableScripts = options.enableScripts !== false;
        
        const themeConfig = options.themeConfiguration || this.themeManager.getCurrentTheme();
        const themeStyles = this.themeManager.generateThemeCSS(themeConfig);
        const customStyles = options.customStyles || '';
        
        return this.getBaseTemplate()
            .replace('{{title}}', this.escapeHtml(title))
            .replace('{{fileName}}', this.escapeHtml(data.fileName))
            .replace('{{timestamp}}', this.escapeHtml(data.timestamp))
            .replace('{{content}}', data.content) // Content is already processed HTML
            .replace('{{themeStyles}}', themeStyles)
            .replace('{{customStyles}}', customStyles)
            .replace('{{scripts}}', enableScripts ? this.getScriptSection() : '');
    }
    
    public getThemeManager(): ThemeManager {
        return this.themeManager;
    }
    
    public dispose(): void {
        this.themeManager.dispose();
    }

    public getBaseTemplate(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
    <title>{{title}}</title>
    <style>
        ${this.getBaseStyles()}
        {{themeStyles}}
        {{customStyles}}
    </style>
</head>
<body>
    <div class="header">
        <h1>DebugBuddy Code Review</h1>
        <div class="file-info">
            <span class="filename">{{fileName}}</span>
            <span class="timestamp">{{timestamp}}</span>
        </div>
    </div>
    <div class="content">
        {{content}}
    </div>
    {{scripts}}
</body>
</html>`;
    }

    public escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    private getBaseStyles(): string {
        return `
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
            padding: 20px;
            line-height: 1.6;
        }
        
        .header {
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 15px;
            margin-bottom: 20px;
        }
        
        .header h1 {
            margin: 0 0 10px 0;
            color: var(--vscode-titleBar-activeForeground);
            font-size: 1.5em;
        }
        
        .file-info {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 0.9em;
            color: var(--vscode-descriptionForeground);
        }
        
        .filename {
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
        }
        
        .timestamp {
            font-style: italic;
        }
        
        .content {
            word-wrap: break-word;
            background-color: var(--vscode-textBlockQuote-background);
            border: 1px solid var(--vscode-textBlockQuote-border);
            border-radius: 4px;
            padding: 15px;
            margin-top: 10px;
        }
        
        /* Markdown styling */
        .content h1, .content h2, .content h3 {
            color: var(--vscode-titleBar-activeForeground);
            margin-top: 1.5em;
            margin-bottom: 0.5em;
        }
        
        .content h1 { 
            font-size: 1.8em; 
            border-bottom: 2px solid var(--vscode-panel-border); 
            padding-bottom: 0.3em; 
        }
        
        .content h2 { 
            font-size: 1.5em; 
            border-bottom: 1px solid var(--vscode-panel-border); 
            padding-bottom: 0.2em; 
        }
        
        .content h3 { 
            font-size: 1.3em; 
        }
        
        .content p {
            margin: 1em 0;
            line-height: 1.6;
        }
        
        .content ul, .content ol {
            margin: 1em 0;
            padding-left: 2em;
        }
        
        .content li {
            margin: 0.5em 0;
        }
        
        .content strong {
            font-weight: bold;
            color: var(--vscode-textPreformat-foreground);
        }
        
        .content em {
            font-style: italic;
            color: var(--vscode-textPreformat-foreground);
        }
        
        /* Code block styling */
        .content pre {
            background-color: var(--vscode-textCodeBlock-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 1em;
            margin: 1em 0;
            overflow-x: auto;
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
            line-height: 1.4;
        }
        
        .content code.inline {
            background-color: var(--vscode-textCodeBlock-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 3px;
            padding: 0.2em 0.4em;
            font-family: var(--vscode-editor-font-family);
            font-size: 0.9em;
        }
        
        .content code.highlighted {
            background: transparent;
            border: none;
            padding: 0;
        }
        
        /* Syntax highlighting colors */
        .content .keyword {
            color: var(--vscode-symbolIcon-keywordForeground, #569cd6);
            font-weight: bold;
        }
        
        .content .string {
            color: var(--vscode-symbolIcon-stringForeground, #ce9178);
        }
        
        .content .number {
            color: var(--vscode-symbolIcon-numberForeground, #b5cea8);
        }
        
        .content .comment {
            color: var(--vscode-symbolIcon-colorForeground, #6a9955);
            font-style: italic;
        }
        
        .content .function {
            color: var(--vscode-symbolIcon-functionForeground, #dcdcaa);
        }
        
        .content .type {
            color: var(--vscode-symbolIcon-typeForeground, #4ec9b0);
        }
        
        .content .variable {
            color: var(--vscode-symbolIcon-variableForeground, #9cdcfe);
        }
        
        .content .tag {
            color: var(--vscode-symbolIcon-keywordForeground, #569cd6);
        }
        
        .content .tag-name {
            color: var(--vscode-symbolIcon-functionForeground, #dcdcaa);
        }
        
        .content .attribute {
            color: var(--vscode-symbolIcon-propertyForeground, #92c5f8);
        }
        
        .content .attribute-name {
            color: var(--vscode-symbolIcon-propertyForeground, #92c5f8);
        }
        
        .content .operator {
            color: var(--vscode-symbolIcon-operatorForeground, #d4d4d4);
        }
        
        .content .selector {
            color: var(--vscode-symbolIcon-functionForeground, #dcdcaa);
        }
        
        .content .property {
            color: var(--vscode-symbolIcon-propertyForeground, #92c5f8);
        }
        
        .content .value {
            color: var(--vscode-symbolIcon-stringForeground, #ce9178);
        }
        
        .content .key {
            color: var(--vscode-symbolIcon-keywordForeground, #569cd6);
        }
        
        .error-message {
            color: var(--vscode-errorForeground);
            background-color: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            border-radius: 4px;
            padding: 10px;
            margin: 10px 0;
        }
        
        .loading {
            color: var(--vscode-descriptionForeground);
            font-style: italic;
        }
        
        /* Additional utility classes */
        .text-center {
            text-align: center;
        }
        
        .text-muted {
            color: var(--vscode-descriptionForeground);
        }
        
        .border-top {
            border-top: 1px solid var(--vscode-panel-border);
            padding-top: 15px;
            margin-top: 20px;
        }
        
        .no-content {
            text-align: center;
            color: var(--vscode-descriptionForeground);
            font-style: italic;
            padding: 40px 20px;
        }`;
    }

    private getScriptSection(): string {
        return `
    <script>
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'updateTheme':
                    // Theme updates are handled automatically via CSS regeneration
                    // This message can be used for any additional theme-specific logic
                    console.log('Theme updated in webview');
                    break;
                case 'scrollToTop':
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    break;
                case 'scrollToBottom':
                    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                    break;
                case 'refreshContent':
                    // Trigger a content refresh if needed
                    location.reload();
                    break;
                case 'expandAll':
                    document.querySelectorAll('details').forEach(detail => detail.open = true);
                    break;
                case 'collapseAll':
                    document.querySelectorAll('details').forEach(detail => detail.open = false);
                    break;
            }
        });
        
        // Enhanced copy functionality with better error handling
        document.addEventListener('DOMContentLoaded', function() {
            const codeBlocks = document.querySelectorAll('pre code');
            codeBlocks.forEach(function(codeBlock, index) {
                const pre = codeBlock.parentElement;
                if (pre) {
                    const copyButton = document.createElement('button');
                    copyButton.className = 'copy-button';
                    copyButton.textContent = 'Copy';
                    copyButton.setAttribute('data-code-index', index.toString());
                    copyButton.style.cssText = \`
                        position: absolute;
                        top: 8px;
                        right: 8px;
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: 1px solid var(--vscode-button-border, transparent);
                        border-radius: 3px;
                        padding: 4px 8px;
                        font-size: 12px;
                        cursor: pointer;
                        opacity: 0.7;
                        transition: all 0.2s ease;
                        z-index: 10;
                    \`;
                    
                    copyButton.addEventListener('mouseenter', function() {
                        this.style.opacity = '1';
                        this.style.background = 'var(--vscode-button-hoverBackground)';
                    });
                    
                    copyButton.addEventListener('mouseleave', function() {
                        this.style.opacity = '0.7';
                        this.style.background = 'var(--vscode-button-background)';
                    });
                    
                    copyButton.addEventListener('click', async function() {
                        const codeText = codeBlock.textContent || '';
                        
                        try {
                            // Try modern clipboard API first
                            if (navigator.clipboard && window.isSecureContext) {
                                await navigator.clipboard.writeText(codeText);
                                showCopySuccess(copyButton);
                            } else {
                                const textArea = document.createElement('textarea');
                                textArea.value = codeText;
                                textArea.style.position = 'fixed';
                                textArea.style.left = '-999999px';
                                textArea.style.top = '-999999px';
                                document.body.appendChild(textArea);
                                textArea.focus();
                                textArea.select();
                                
                                try {
                                    document.execCommand('copy');
                                    showCopySuccess(copyButton);
                                } catch (err) {
                                    console.error('Failed to copy text:', err);
                                    showCopyError(copyButton);
                                } finally {
                                    document.body.removeChild(textArea);
                                }
                            }
                        } catch (err) {
                            console.error('Copy operation failed:', err);
                            showCopyError(copyButton);
                        }
                    });
                    
                    pre.style.position = 'relative';
                    pre.appendChild(copyButton);
                }
            });
            
            const longSections = document.querySelectorAll('.content > div, .content > section');
            longSections.forEach(function(section) {
                if (section.scrollHeight > 400) {
                    const collapseButton = document.createElement('button');
                    collapseButton.className = 'collapse-button';
                    collapseButton.textContent = 'Show Less';
                    collapseButton.style.cssText = \`
                        margin-top: 10px;
                        background: var(--vscode-button-secondaryBackground);
                        color: var(--vscode-button-secondaryForeground);
                        border: 1px solid var(--vscode-button-border, transparent);
                        border-radius: 3px;
                        padding: 6px 12px;
                        font-size: 12px;
                        cursor: pointer;
                    \`;
                    
                    let isCollapsed = false;
                    const originalMaxHeight = section.style.maxHeight;
                    
                    collapseButton.addEventListener('click', function() {
                        if (isCollapsed) {
                            section.style.maxHeight = originalMaxHeight;
                            section.style.overflow = 'visible';
                            collapseButton.textContent = 'Show Less';
                            isCollapsed = false;
                        } else {
                            section.style.maxHeight = '400px';
                            section.style.overflow = 'hidden';
                            collapseButton.textContent = 'Show More';
                            isCollapsed = true;
                        }
                    });
                    
                    section.appendChild(collapseButton);
                }
            });
        });
        
        function showCopySuccess(button) {
            const originalText = button.textContent;
            button.textContent = 'Copied!';
            button.style.background = 'var(--vscode-testing-iconPassed, #73c991)';
            button.style.color = 'var(--vscode-editor-background, #ffffff)';
            
            setTimeout(function() {
                button.textContent = originalText;
                button.style.background = 'var(--vscode-button-background)';
                button.style.color = 'var(--vscode-button-foreground)';
            }, 2000);
        }
        
        function showCopyError(button) {
            const originalText = button.textContent;
            button.textContent = 'Failed';
            button.style.background = 'var(--vscode-errorForeground, #f48771)';
            button.style.color = 'var(--vscode-editor-background, #ffffff)';
            
            setTimeout(function() {
                button.textContent = originalText;
                button.style.background = 'var(--vscode-button-background)';
                button.style.color = 'var(--vscode-button-foreground)';
            }, 2000);
        }
    </script>`;
    }
}