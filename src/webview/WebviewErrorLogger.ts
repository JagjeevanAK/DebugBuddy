import * as vscode from 'vscode';

export interface WebviewError {
    operation: string;
    error: Error;
    fallbackUsed: boolean;
    timestamp: string;
    context?: any;
}

export interface WebviewErrorStats {
    totalErrors: number;
    fallbackUsageCount: number;
    lastError?: WebviewError;
    errorsByOperation: Record<string, number>;
    recentErrors: WebviewError[];
    criticalErrorCount: number;
    fallbackSuccessRate: number;
}

export class WebviewErrorLogger {
    private static instance: WebviewErrorLogger;
    private errors: WebviewError[] = [];
    private readonly maxErrorHistory = 50;
    private outputChannel: vscode.OutputChannel;

    private constructor() {
        this.outputChannel = vscode.window.createOutputChannel('DebugBuddy Webview Errors');
    }

    public static getInstance(): WebviewErrorLogger {
        if (!WebviewErrorLogger.instance) {
            WebviewErrorLogger.instance = new WebviewErrorLogger();
        }
        return WebviewErrorLogger.instance;
    }

    public logError(operation: string, error: Error, fallbackUsed: boolean, context?: any): void {
        const webviewError: WebviewError = {
            operation,
            error,
            fallbackUsed,
            timestamp: new Date().toISOString(),
            context
        };

        this.errors.unshift(webviewError);
        
        // Limit history size
        if (this.errors.length > this.maxErrorHistory) {
            this.errors = this.errors.slice(0, this.maxErrorHistory);
        }

        // Log to output channel
        this.logToOutputChannel(webviewError);

        // Log to console for development
        console.error(`DebugBuddy Webview Error [${operation}]:`, error);
        if (fallbackUsed) {
            console.warn('DebugBuddy: Fallback to terminal display was used');
        }
    }

    public getErrorStats(): WebviewErrorStats {
        const errorsByOperation: Record<string, number> = {};
        
        this.errors.forEach(error => {
            errorsByOperation[error.operation] = (errorsByOperation[error.operation] || 0) + 1;
        });

        const recentErrors = this.errors.slice(0, 5);
        const criticalErrors = this.errors.filter(e => this.isCriticalError(e));

        return {
            totalErrors: this.errors.length,
            fallbackUsageCount: this.errors.filter(e => e.fallbackUsed).length,
            lastError: this.errors[0],
            errorsByOperation,
            recentErrors,
            criticalErrorCount: criticalErrors.length,
            fallbackSuccessRate: this.calculateFallbackSuccessRate()
        };
    }

    private isCriticalError(error: WebviewError): boolean {
        const criticalPatterns = [
            'Extension context is invalid',
            'VS Code returned undefined',
            'Webview object is not available',
            'Failed to create webview panel'
        ];
        
        return criticalPatterns.some(pattern => 
            error.error.message.toLowerCase().includes(pattern.toLowerCase())
        );
    }

    private calculateFallbackSuccessRate(): number {
        const fallbackAttempts = this.errors.filter(e => e.fallbackUsed);
        if (fallbackAttempts.length === 0) {
            return 100;
        }
        
        const fallbackFailures = fallbackAttempts.filter(e => {
            return e.operation === 'fallbackToTerminal' && !e.fallbackUsed;
        });
        
        return Math.round(((fallbackAttempts.length - fallbackFailures.length) / fallbackAttempts.length) * 100);
    }

    public getRecentErrors(count: number = 10): WebviewError[] {
        return this.errors.slice(0, count);
    }

    public clearErrors(): void {
        this.errors = [];
        this.outputChannel.clear();
    }

    public showErrorLog(): void {
        this.outputChannel.show();
    }

    private logToOutputChannel(error: WebviewError): void {
        const timestamp = new Date(error.timestamp).toLocaleString();
        this.outputChannel.appendLine(`[${timestamp}] ${error.operation} - ${error.error.message}`);
        
        if (error.error.stack) {
            this.outputChannel.appendLine(`Stack: ${error.error.stack}`);
        }
        
        if (error.context) {
            this.outputChannel.appendLine(`Context: ${JSON.stringify(error.context, null, 2)}`);
        }
        
        if (error.fallbackUsed) {
            this.outputChannel.appendLine('Fallback to terminal display was used');
        }
        
        this.outputChannel.appendLine('---');
    }

    public getWebviewHealthStatus(): { status: 'healthy' | 'degraded' | 'critical', message: string, recommendations: string[] } {
        const stats = this.getErrorStats();
        const recentErrorCount = this.errors.filter(e => {
            const errorTime = new Date(e.timestamp);
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            return errorTime > fiveMinutesAgo;
        }).length;

        if (stats.criticalErrorCount > 0 && recentErrorCount > 3) {
            return {
                status: 'critical',
                message: 'Webview system is experiencing critical issues',
                recommendations: [
                    'Restart VS Code',
                    'Check extension logs',
                    'Disable and re-enable the extension',
                    'Report the issue if it persists'
                ]
            };
        } else if (stats.fallbackUsageCount > 5 || recentErrorCount > 1) {
            return {
                status: 'degraded',
                message: 'Webview system is experiencing some issues but fallback is working',
                recommendations: [
                    'Check error logs for patterns',
                    'Consider restarting VS Code if issues persist',
                    'Monitor for improvement'
                ]
            };
        } else {
            return {
                status: 'healthy',
                message: 'Webview system is operating normally',
                recommendations: []
            };
        }
    }

    public dispose(): void {
        this.outputChannel.dispose();
    }
}