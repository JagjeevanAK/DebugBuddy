import * as vscode from 'vscode';

export interface ThemeConfiguration {
    backgroundColor: string;
    foregroundColor: string;
    accentColor: string;
    codeBackgroundColor: string;
    borderColor: string;
    editorBackground: string;
    panelBackground: string;
    titleBarForeground: string;
    descriptionForeground: string;
    textLinkForeground: string;
    errorForeground: string;
    warningForeground: string;
    successForeground: string;
    buttonBackground: string;
    buttonForeground: string;
    inputBackground: string;
    inputBorder: string;
    focusBorder: string;
    selectionBackground: string;
    kind: vscode.ColorThemeKind;
}

export interface IThemeManager {
    getCurrentTheme(): ThemeConfiguration;
    generateThemeCSS(theme: ThemeConfiguration): string;
    onThemeChanged(callback: (theme: ThemeConfiguration) => void): vscode.Disposable;
    dispose(): void;
}

export class ThemeManager implements IThemeManager {
    private disposables: vscode.Disposable[] = [];
    private themeChangeCallbacks: ((theme: ThemeConfiguration) => void)[] = [];

    constructor() {
        // Listen for theme changes
        this.disposables.push(
            vscode.window.onDidChangeActiveColorTheme(() => {
                const newTheme = this.getCurrentTheme();
                this.notifyThemeChange(newTheme);
            })
        );
    }

    public getCurrentTheme(): ThemeConfiguration {
        const colorTheme = vscode.window.activeColorTheme;
        
        const theme: ThemeConfiguration = {
            backgroundColor: this.getThemeColor('editor.background', '#1e1e1e'),
            foregroundColor: this.getThemeColor('editor.foreground', '#d4d4d4'),
            accentColor: this.getThemeColor('focusBorder', '#007acc'),
            codeBackgroundColor: this.getThemeColor('textCodeBlock.background', '#0d1117'),
            borderColor: this.getThemeColor('panel.border', '#2d2d30'),
            editorBackground: this.getThemeColor('editor.background', '#1e1e1e'),
            panelBackground: this.getThemeColor('panel.background', '#252526'),
            titleBarForeground: this.getThemeColor('titleBar.activeForeground', '#cccccc'),
            descriptionForeground: this.getThemeColor('descriptionForeground', '#cccccc99'),
            textLinkForeground: this.getThemeColor('textLink.foreground', '#3794ff'),
            errorForeground: this.getThemeColor('errorForeground', '#f48771'),
            warningForeground: this.getThemeColor('warningForeground', '#ffcc02'),
            successForeground: this.getThemeColor('terminal.ansiGreen', '#16c60c'),
            buttonBackground: this.getThemeColor('button.background', '#0e639c'),
            buttonForeground: this.getThemeColor('button.foreground', '#ffffff'),
            inputBackground: this.getThemeColor('input.background', '#3c3c3c'),
            inputBorder: this.getThemeColor('input.border', '#3c3c3c'),
            focusBorder: this.getThemeColor('focusBorder', '#007acc'),
            selectionBackground: this.getThemeColor('editor.selectionBackground', '#264f78'),
            kind: colorTheme.kind
        };

        return theme;
    } 
   public generateThemeCSS(theme: ThemeConfiguration): string {
        return `
        :root {
            /* Base colors */
            --theme-background: ${theme.backgroundColor};
            --theme-foreground: ${theme.foregroundColor};
            --theme-accent: ${theme.accentColor};
            --theme-border: ${theme.borderColor};
            
            /* Editor colors */
            --theme-editor-background: ${theme.editorBackground};
            --theme-code-background: ${theme.codeBackgroundColor};
            --theme-panel-background: ${theme.panelBackground};
            
            /* Text colors */
            --theme-title-foreground: ${theme.titleBarForeground};
            --theme-description-foreground: ${theme.descriptionForeground};
            --theme-link-foreground: ${theme.textLinkForeground};
            
            /* Status colors */
            --theme-error-foreground: ${theme.errorForeground};
            --theme-warning-foreground: ${theme.warningForeground};
            --theme-success-foreground: ${theme.successForeground};
            
            /* Interactive colors */
            --theme-button-background: ${theme.buttonBackground};
            --theme-button-foreground: ${theme.buttonForeground};
            --theme-input-background: ${theme.inputBackground};
            --theme-input-border: ${theme.inputBorder};
            --theme-focus-border: ${theme.focusBorder};
            --theme-selection-background: ${theme.selectionBackground};
            
            /* Theme kind specific adjustments */
            --theme-opacity-light: ${theme.kind === vscode.ColorThemeKind.Light ? '0.1' : '0.2'};
            --theme-opacity-medium: ${theme.kind === vscode.ColorThemeKind.Light ? '0.2' : '0.4'};
            --theme-opacity-heavy: ${theme.kind === vscode.ColorThemeKind.Light ? '0.4' : '0.6'};
        }
        
        /* Enhanced theme-aware styles */
        body {
            background-color: var(--theme-background);
            color: var(--theme-foreground);
        }
        
        .header {
            border-bottom-color: var(--theme-border);
        }
        
        .header h1 {
            color: var(--theme-title-foreground);
        }
        
        .filename {
            color: var(--theme-link-foreground);
        }
        
        .timestamp {
            color: var(--theme-description-foreground);
        }
        
        .content {
            background-color: var(--theme-panel-background);
            border-color: var(--theme-border);
        }
        
        .content pre {
            background-color: var(--theme-code-background);
            border-color: var(--theme-border);
        }
        
        .content code.inline {
            background-color: var(--theme-code-background);
            border-color: var(--theme-border);
        }
        
        .error-message {
            color: var(--theme-error-foreground);
            background-color: color-mix(in srgb, var(--theme-error-foreground) var(--theme-opacity-light), transparent);
            border-color: var(--theme-error-foreground);
        }
        
        .warning-message {
            color: var(--theme-warning-foreground);
            background-color: color-mix(in srgb, var(--theme-warning-foreground) var(--theme-opacity-light), transparent);
            border-color: var(--theme-warning-foreground);
        }
        
        .success-message {
            color: var(--theme-success-foreground);
            background-color: color-mix(in srgb, var(--theme-success-foreground) var(--theme-opacity-light), transparent);
            border-color: var(--theme-success-foreground);
        }
        
        /* Button styling with theme colors */
        button {
            background-color: var(--theme-button-background);
            color: var(--theme-button-foreground);
            border: 1px solid var(--theme-border);
        }
        
        button:hover {
            background-color: color-mix(in srgb, var(--theme-button-background) 80%, var(--theme-foreground) 20%);
        }
        
        button:focus {
            outline: 2px solid var(--theme-focus-border);
            outline-offset: 2px;
        }
        
        /* Selection styling */
        ::selection {
            background-color: var(--theme-selection-background);
        }
        
        /* Scrollbar styling for theme consistency */
        ::-webkit-scrollbar {
            width: 12px;
        }
        
        ::-webkit-scrollbar-track {
            background: var(--theme-background);
        }
        
        ::-webkit-scrollbar-thumb {
            background: var(--theme-border);
            border-radius: 6px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
            background: color-mix(in srgb, var(--theme-border) 70%, var(--theme-foreground) 30%);
        }`;
    }

    public onThemeChanged(callback: (theme: ThemeConfiguration) => void): vscode.Disposable {
        this.themeChangeCallbacks.push(callback);
        
        return new vscode.Disposable(() => {
            const index = this.themeChangeCallbacks.indexOf(callback);
            if (index > -1) {
                this.themeChangeCallbacks.splice(index, 1);
            }
        });
    }

    public dispose(): void {
        this.disposables.forEach(disposable => disposable.dispose());
        this.disposables = [];
        this.themeChangeCallbacks = [];
    }

    private getThemeColor(colorId: string, fallback: string): string {
        try {
            // Try to get the color from VS Code's theme
            const color = new vscode.ThemeColor(colorId);
            // Since we can't directly resolve ThemeColor to string in extension context,
            // we'll use the fallback and let CSS variables handle the actual theming
            return `var(--vscode-${colorId.replace('.', '-')}, ${fallback})`;
        } catch (error) {
            return fallback;
        }
    }

    private notifyThemeChange(theme: ThemeConfiguration): void {
        this.themeChangeCallbacks.forEach(callback => {
            try {
                callback(theme);
            } catch (error) {
                console.error('DebugBuddy: Error in theme change callback:', error);
            }
        });
    }
}