/**
 * ErrorHandler - Comprehensive error handling for the prompt system
 */

import { IErrorHandler } from './interfaces';
import { PromptError, FallbackStrategy } from './types';

export interface Logger {
    error(...args: any[]): void;
    warn(...args: any[]): void;
}

export class ErrorHandler implements IErrorHandler {
    private static readonly ERROR_LOG_PREFIX = '[PromptSystem]';
    private static readonly MAX_ERROR_CONTEXT_LENGTH = 500;

    private errorCounts: Map<PromptError, number> = new Map();
    private lastErrors: Map<PromptError, Date> = new Map();
    private errorCallbacks: Array<(error: PromptError, message: string, context?: any) => void> = [];

    constructor(
        private enableConsoleLogging: boolean = true,
        private logger: Logger = console
    ) {
        // Initialize error counts
        Object.values(PromptError).forEach(error => {
            this.errorCounts.set(error, 0);
        });
    }

    /**
     * Handle prompt system errors with appropriate fallback strategies
     */
    handleError(error: PromptError, context: any): FallbackStrategy {
        this.logError(error, this.getErrorMessage(error), context);

        switch (error) {
            case PromptError.TEMPLATE_PARSE_ERROR:
                return this.handleTemplateParseError(context);

            case PromptError.VARIABLE_SUBSTITUTION_ERROR:
                return this.handleVariableSubstitutionError(context);

            case PromptError.VALIDATION_ERROR:
                return this.handleValidationError(context);

            case PromptError.CONFIGURATION_ERROR:
                return this.handleConfigurationError(context);

            case PromptError.PROMPT_NOT_FOUND:
                return this.handlePromptNotFoundError(context);

            default:
                return this.getDefaultFallbackStrategy();
        }
    }

    /**
     * Log error with context information
     */
    logError(error: PromptError, message: string, context?: any): void {
        // Increment error count first
        this.incrementErrorCount(error);
        
        const timestamp = new Date().toISOString();
        const errorCount = this.errorCounts.get(error) || 0;
        
        const logMessage = `${ErrorHandler.ERROR_LOG_PREFIX} [${timestamp}] ${error}: ${message}`;
        const contextInfo = context ? this.formatContext(context) : '';
        
        if (this.enableConsoleLogging) {
            this.logger.error(logMessage);
            if (contextInfo) {
                this.logger.error(`Context: ${contextInfo}`);
            }
            if (errorCount > 1) {
                this.logger.warn(`This error has occurred ${errorCount} times`);
            }
        }

        // Update last error time
        this.lastErrors.set(error, new Date());

        // Notify registered callbacks
        this.notifyErrorCallbacks(error, message, context);
    }

    /**
     * Register a callback for error notifications
     */
    onError(callback: (error: PromptError, message: string, context?: any) => void): void {
        this.errorCallbacks.push(callback);
    }

    /**
     * Get error statistics
     */
    getErrorStats(): { [key in PromptError]: { count: number; lastOccurred?: Date } } {
        const stats = {} as { [key in PromptError]: { count: number; lastOccurred?: Date } };
        
        Object.values(PromptError).forEach(error => {
            stats[error] = {
                count: this.errorCounts.get(error) || 0,
                lastOccurred: this.lastErrors.get(error)
            };
        });

        return stats;
    }

    /**
     * Clear error statistics
     */
    clearErrorStats(): void {
        this.errorCounts.clear();
        this.lastErrors.clear();
        Object.values(PromptError).forEach(error => {
            this.errorCounts.set(error, 0);
        });
    }

    /**
     * Check if an error type is occurring frequently
     */
    isErrorFrequent(error: PromptError, threshold: number = 5): boolean {
        return (this.errorCounts.get(error) || 0) >= threshold;
    }

    /**
     * Handle template parse errors
     */
    private handleTemplateParseError(context: any): FallbackStrategy {
        const promptId = context?.promptId || 'unknown';
        const originalError = context?.originalError || 'Unknown parsing error';
        
        const errorMessage = `Template parsing failed for '${promptId}': ${originalError}. Please check the template syntax and structure.`;
        
        // No longer provide fallback - template errors should be fixed at the source
        return {
            useSimplePrompt: false,
            errorMessage,
            fallbackPromptId: undefined
        };
    }

    /**
     * Handle variable substitution errors
     */
    private handleVariableSubstitutionError(context: any): FallbackStrategy {
        const promptId = context?.promptId || 'unknown';
        const missingVariables = context?.missingVariables || [];
        const originalError = context?.originalError || 'Unknown substitution error';
        
        let errorMessage = `Variable substitution failed for '${promptId}': ${originalError}`;
        if (missingVariables.length > 0) {
            errorMessage += `. Missing variables: ${missingVariables.join(', ')}`;
        }
        errorMessage += '. Please check template variable definitions and context data.';
        
        // No longer provide fallback - variable errors should be addressed properly
        return {
            useSimplePrompt: false,
            errorMessage,
            fallbackPromptId: undefined
        };
    }

    /**
     * Handle validation errors
     */
    private handleValidationError(context: any): FallbackStrategy {
        const promptId = context?.promptId || 'unknown';
        const errors = context?.errors || [];
        const suggestions = context?.suggestions || [];
        
        let errorMessage = `Prompt validation failed for '${promptId}'`;
        if (errors.length > 0) {
            errorMessage += `: ${errors.join(', ')}`;
        }
        if (suggestions.length > 0) {
            errorMessage += `. Suggestions: ${suggestions.join(', ')}`;
        }
        
        // No longer provide fallback - validation errors should be fixed at the source
        return {
            useSimplePrompt: false,
            errorMessage,
            fallbackPromptId: undefined
        };
    }

    /**
     * Handle configuration errors
     */
    private handleConfigurationError(context: any): FallbackStrategy {
        const component = context?.component || 'unknown component';
        const originalError = context?.originalError || 'Unknown configuration error';
        
        const errorMessage = `Configuration error in ${component}: ${originalError}. Please check system configuration and settings.`;
        
        // Configuration errors may allow continued operation with warnings
        return {
            useSimplePrompt: false,
            errorMessage,
            fallbackPromptId: context?.promptId
        };
    }

    /**
     * Handle prompt not found errors
     */
    private handlePromptNotFoundError(context: any): FallbackStrategy {
        const requestedType = context?.requestedType || context?.promptId || 'unknown';
        const availableTypes = context?.availableTypes || [];
        
        let errorMessage: string;
        if (availableTypes.length > 0) {
            errorMessage = `JSON prompt '${requestedType}' not found. Available prompt types: ${availableTypes.join(', ')}. Please ensure the required prompt template is properly configured.`;
        } else {
            errorMessage = `No JSON prompts are currently loaded. Please ensure prompt templates are properly configured and available in the templates directory.`;
        }
        
        // No longer provide fallback - return error information for proper error handling
        return {
            useSimplePrompt: false,
            errorMessage,
            fallbackPromptId: undefined
        };
    }

    /**
     * Get default fallback strategy for unknown errors
     */
    private getDefaultFallbackStrategy(): FallbackStrategy {
        return {
            useSimplePrompt: false,
            errorMessage: 'Unknown error occurred in the prompt system. Please check system logs and configuration.',
            fallbackPromptId: undefined
        };
    }

    /**
     * Get human-readable error message for error type
     */
    private getErrorMessage(error: PromptError): string {
        switch (error) {
            case PromptError.TEMPLATE_PARSE_ERROR:
                return 'Failed to parse prompt template - check template syntax and structure';
            case PromptError.VARIABLE_SUBSTITUTION_ERROR:
                return 'Failed to substitute template variables - verify variable definitions and context data';
            case PromptError.VALIDATION_ERROR:
                return 'Prompt validation failed - check template structure and required fields';
            case PromptError.CONFIGURATION_ERROR:
                return 'Configuration error occurred - verify system settings and configuration files';
            case PromptError.PROMPT_NOT_FOUND:
                return 'Requested JSON prompt not found - check available prompt types and configuration';
            default:
                return 'Unknown prompt system error - check system logs for details';
        }
    }

    /**
     * Format context information for logging
     */
    private formatContext(context: any): string {
        if (!context) {
            return '';
        }

        try {
            let contextStr = JSON.stringify(context, null, 2);
            
            // Truncate if too long
            if (contextStr.length > ErrorHandler.MAX_ERROR_CONTEXT_LENGTH) {
                contextStr = contextStr.substring(0, ErrorHandler.MAX_ERROR_CONTEXT_LENGTH) + '...';
            }
            
            return contextStr;
        } catch (error) {
            return '[Context serialization failed]';
        }
    }

    /**
     * Increment error count for tracking
     */
    private incrementErrorCount(error: PromptError): void {
        const currentCount = this.errorCounts.get(error) || 0;
        this.errorCounts.set(error, currentCount + 1);
    }

    /**
     * Notify all registered error callbacks
     */
    private notifyErrorCallbacks(error: PromptError, message: string, context?: any): void {
        for (const callback of this.errorCallbacks) {
            try {
                callback(error, message, context);
            } catch (callbackError) {
                // Don't let callback errors break the error handling
                if (this.enableConsoleLogging) {
                    this.logger.error(`${ErrorHandler.ERROR_LOG_PREFIX} Error in error callback:`, callbackError);
                }
            }
        }
    }



    /**
     * Validate error recovery capabilities
     */
    validateRecoveryCapabilities(): { canRecover: boolean; issues: string[] } {
        const issues: string[] = [];
        
        const frequentErrors = Object.values(PromptError).filter(error => 
            this.isErrorFrequent(error, 10)
        );
        
        if (frequentErrors.length > 0) {
            issues.push(`Frequent errors detected: ${frequentErrors.join(', ')}`);
        }
        
        if (this.errorCallbacks.length === 0) {
            issues.push('No error callbacks registered - errors may not be properly handled');
        }
        
        return {
            canRecover: issues.length === 0,
            issues
        };
    }
}

/**
 * Global error handler instance for the prompt system
 */
export const promptErrorHandler = new ErrorHandler();

/**
 * Utility function to wrap prompt operations with error handling
 */
export function withErrorHandling<T>(
    operation: () => T,
    errorType: PromptError,
    context?: any
): T | null {
    try {
        return operation();
    } catch (error) {
        promptErrorHandler.handleError(errorType, {
            ...context,
            originalError: error instanceof Error ? error.message : 'Unknown error'
        });
        return null;
    }
}

/**
 * Async version of withErrorHandling
 */
export async function withAsyncErrorHandling<T>(
    operation: () => Promise<T>,
    errorType: PromptError,
    context?: any
): Promise<T | null> {
    try {
        return await operation();
    } catch (error) {
        promptErrorHandler.handleError(errorType, {
            ...context,
            originalError: error instanceof Error ? error.message : 'Unknown error'
        });
        return null;
    }
}