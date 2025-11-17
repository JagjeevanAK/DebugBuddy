/**
 * Context Analyzer for automatic prompt selection
 * Analyzes user actions and code context to determine the most appropriate prompt
 */

import { IContextAnalyzer } from './interfaces';
import { UserAction, CodeContext, PromptContext, PromptCategory } from './types';
import { getLanguageFromExtension, getLanguageFromVSCode } from '../helper/getlang';
import { vscode } from '../helper/vscode';

export class ContextAnalyzer implements IContextAnalyzer {
    private readonly actionToPromptMapping: Map<UserAction, string> = new Map([
        [UserAction.CODE_REVIEW, 'code-review'],
        [UserAction.DEBUG_ERROR, 'debug-analysis'],
        [UserAction.REFACTOR, 'refactoring'],
        [UserAction.GENERATE_DOCS, 'documentation'],
        [UserAction.SECURITY_ANALYSIS, 'security-analysis'],
        [UserAction.PERFORMANCE_ANALYSIS, 'performance-analysis'],
        [UserAction.EXPLAIN_CODE, 'code-explanation']
    ]);

    private readonly errorTypeToPromptMapping: Map<string, string> = new Map([
        ['syntax', 'debug-analysis'],
        ['type', 'debug-analysis'],
        ['runtime', 'debug-analysis'],
        ['compile', 'debug-analysis'],
        ['lint', 'code-review'],
        ['security', 'security-analysis'],
        ['performance', 'performance-analysis']
    ]);

    /**
     * Analyze context to determine appropriate prompt
     */
    analyzeContext(action: UserAction, context: CodeContext): PromptContext {
        const language = this.detectLanguage(context);
        const errorAnalysis = this.analyzeErrorContext(context);
        const fileType = this.determineFileType(context.filePath, language);

        return {
            action,
            language,
            hasError: errorAnalysis.hasError,
            errorType: errorAnalysis.errorType,
            codeSelection: context.selectedText,
            fileType,
            projectContext: this.analyzeProjectContext(context)
        };
    }

    /**
     * Determine the best prompt type for the given context
     */
    determinePromptType(context: PromptContext): string {
        // If there's an error, prioritize error-specific prompts
        if (context.hasError && context.errorType) {
            const errorPrompt = this.errorTypeToPromptMapping.get(context.errorType);
            if (errorPrompt) {
                return errorPrompt;
            }
        }

        // Use action-based mapping as primary strategy
        const actionPrompt = this.actionToPromptMapping.get(context.action);
        if (actionPrompt) {
            return actionPrompt;
        }

        return 'general';
    }

    /**
     * Detect programming language from context
     */
    private detectLanguage(context: CodeContext): string {
        // Try to get language from VS Code if available
        if (vscode.window.activeTextEditor) {
            try {
                const vscodeLanguage = getLanguageFromVSCode(vscode.window.activeTextEditor);
                if (vscodeLanguage && vscodeLanguage !== 'plaintext') {
                    return vscodeLanguage;
                }
            } catch (error) {
                console.warn('Failed to get language from VS Code:', error);
            }
        }

        // Try to detect from file path
        if (context.filePath) {
            const extensionLanguage = getLanguageFromExtension(context.filePath);
            if (extensionLanguage && extensionLanguage !== 'plaintext') {
                return extensionLanguage;
            }
        }

        // Try to detect from context.language if provided
        if (context.language) {
            return context.language;
        }

        return 'plaintext';
    }

    /**
     * Analyze error context to determine error type and presence
     */
    private analyzeErrorContext(context: CodeContext): { hasError: boolean; errorType?: string } {
        if (!context.errorMessage && (!context.diagnostics || context.diagnostics.length === 0)) {
            return { hasError: false };
        }

        let errorType: string | undefined;

        // Analyze error message for type classification
        if (context.errorMessage) {
            errorType = this.classifyErrorType(context.errorMessage);
        }

        // Analyze diagnostics for additional context
        if (context.diagnostics && context.diagnostics.length > 0) {
            const diagnostic = context.diagnostics[0]; // Use first diagnostic for classification
            if (diagnostic.source) {
                const diagnosticType = this.classifyDiagnosticSource(diagnostic.source);
                if (diagnosticType) {
                    errorType = diagnosticType;
                }
            }
        }

        return {
            hasError: true,
            errorType: errorType || 'runtime'
        };
    }

    /**
     * Classify error type based on error message content
     */
    private classifyErrorType(errorMessage: string): string {
        const message = errorMessage.toLowerCase();

        // Syntax errors
        if (message.includes('syntax') || message.includes('unexpected token') ||
            message.includes('parse error') || message.includes('invalid syntax')) {
            return 'syntax';
        }

        // Type errors
        if (message.includes('type') || message.includes('cannot assign') ||
            message.includes('type mismatch') || message.includes('undefined property')) {
            return 'type';
        }

        // Compilation errors
        if (message.includes('compile') || message.includes('build') ||
            message.includes('cannot resolve') || message.includes('module not found')) {
            return 'compile';
        }

        // Security-related errors
        if (message.includes('security') || message.includes('vulnerability') ||
            message.includes('unsafe') || message.includes('xss') || message.includes('injection')) {
            return 'security';
        }

        // Performance-related errors
        if (message.includes('performance') || message.includes('slow') ||
            message.includes('timeout') || message.includes('memory')) {
            return 'performance';
        }

        // Default to runtime error
        return 'runtime';
    }

    /**
     * Classify diagnostic source to determine error type
     */
    private classifyDiagnosticSource(source: string): string | undefined {
        const sourceLower = source.toLowerCase();

        // Linting tools
        if (sourceLower.includes('eslint') || sourceLower.includes('tslint') ||
            sourceLower.includes('pylint') || sourceLower.includes('rubocop')) {
            return 'lint';
        }

        // Type checkers
        if (sourceLower.includes('typescript') || sourceLower.includes('mypy') ||
            sourceLower.includes('flow')) {
            return 'type';
        }

        // Security scanners
        if (sourceLower.includes('security') || sourceLower.includes('bandit') ||
            sourceLower.includes('semgrep')) {
            return 'security';
        }

        // Compilers
        if (sourceLower.includes('compiler') || sourceLower.includes('rustc') ||
            sourceLower.includes('javac')) {
            return 'compile';
        }

        return undefined;
    }

    /**
     * Determine file type based on path and language
     */
    private determineFileType(filePath?: string, language?: string): string {
        if (!filePath) {
            return language || 'unknown';
        }

        const fileName = filePath.split('/').pop() || '';
        const extension = fileName.split('.').pop()?.toLowerCase() || '';

        // Special file types
        if (fileName.toLowerCase().includes('test') || fileName.toLowerCase().includes('spec')) {
            return 'test';
        }

        if (fileName.toLowerCase().includes('config') || extension === 'json' || extension === 'yaml') {
            return 'config';
        }

        if (fileName.toLowerCase().includes('readme') || extension === 'md') {
            return 'documentation';
        }

        if (fileName.toLowerCase().includes('dockerfile') || fileName === 'Dockerfile') {
            return 'docker';
        }

        return language || 'source';
    }

    /**
     * Analyze project context for additional insights
     */
    private analyzeProjectContext(context: CodeContext): { framework?: string; projectType?: string; customRules?: string[] } | undefined {
        if (!context.filePath) {
            return undefined;
        }

        const projectContext: { framework?: string; projectType?: string; customRules?: string[] } = {};

        // Try to detect framework from file path patterns
        const filePath = context.filePath.toLowerCase();

        // Next.js detection (check first since it's more specific)
        if (filePath.includes('next') || filePath.includes('pages/') || filePath.includes('app/')) {
            projectContext.framework = 'nextjs';
        } else if (filePath.includes('react') || filePath.includes('jsx') || filePath.includes('tsx')) {
            projectContext.framework = 'react';
        }

        // Vue.js detection
        if (filePath.includes('vue') || filePath.endsWith('.vue')) {
            projectContext.framework = 'vue';
        }

        // Angular detection
        if (filePath.includes('angular') || filePath.includes('component.ts') || filePath.includes('service.ts')) {
            projectContext.framework = 'angular';
        }

        // Node.js/Express detection
        if (filePath.includes('express') || filePath.includes('server') || filePath.includes('api/')) {
            projectContext.framework = 'express';
        }

        // Determine project type
        if (filePath.includes('test') || filePath.includes('spec')) {
            projectContext.projectType = 'test';
        } else if (filePath.includes('api') || filePath.includes('server') || filePath.includes('backend')) {
            projectContext.projectType = 'backend';
        } else if (filePath.includes('frontend') || filePath.includes('client') || filePath.includes('ui')) {
            projectContext.projectType = 'frontend';
        } else if (filePath.includes('lib') || filePath.includes('utils') || filePath.includes('helpers')) {
            projectContext.projectType = 'library';
        }

        return Object.keys(projectContext).length > 0 ? projectContext : undefined;
    }
}