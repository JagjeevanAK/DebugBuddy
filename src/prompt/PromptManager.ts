/**
 * PromptManager - Orchestrates the entire prompt processing pipeline
 * Integrates all prompt system components into a unified interface
 */

import { IPromptManager } from './interfaces';
import { UserAction, CodeContext, ProcessedPrompt, VariableMap, PromptError } from './types';
import { PromptSystem } from './PromptSystem';
import { ContextAnalyzer } from './ContextAnalyzer';
import { OptimizedTemplateEngine } from './OptimizedTemplateEngine';
import { ConfigurationManager } from './ConfigurationManager';
import { PromptValidator } from './PromptValidator';
import { promptErrorHandler, withAsyncErrorHandling } from './ErrorHandler';
import { vscode } from '../helper/vscode';

export class PromptManager implements IPromptManager {
    private static instance: PromptManager;
    private promptSystem: PromptSystem;
    private contextAnalyzer: ContextAnalyzer;
    private templateEngine: OptimizedTemplateEngine;
    private configManager: ConfigurationManager;
    private promptValidator: PromptValidator;
    private initialized: boolean = false;

    private constructor() {
        this.promptSystem = PromptSystem.getInstance();
        this.contextAnalyzer = new ContextAnalyzer();
        this.templateEngine = new OptimizedTemplateEngine();
        this.configManager = ConfigurationManager.getInstance();
        this.promptValidator = new PromptValidator();
        
        this.setupErrorHandling();
    }

    /**
     * Get the singleton instance of PromptManager
     */
    public static getInstance(): PromptManager {
        if (!PromptManager.instance) {
            PromptManager.instance = new PromptManager();
        }
        return PromptManager.instance;
    }

    /**
     * Initialize the prompt manager
     */
    public async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        const result = await withAsyncErrorHandling(async () => {
            await this.promptSystem.initialize();
            
            const validationResults = this.validatePromptIntegrity();
            const invalidPrompts = validationResults.filter(result => !result.isValid);
            
            if (invalidPrompts.length > 0) {
                promptErrorHandler.logError(
                    PromptError.VALIDATION_ERROR,
                    `Found ${invalidPrompts.length} invalid prompts during initialization`,
                    { invalidPrompts: invalidPrompts.map(p => p.name) }
                );
            }
            
            this.initialized = true;
            return true;
        }, PromptError.CONFIGURATION_ERROR, { component: 'PromptManager' });

        if (result === null) {
            throw new Error('Failed to initialize PromptManager');
        }
    }

    /**
     * Process a request through the complete prompt pipeline
     */
    public async processRequest(action: UserAction, context: CodeContext): Promise<ProcessedPrompt> {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const promptContext = this.contextAnalyzer.analyzeContext(action, context);
            const promptType = this.contextAnalyzer.determinePromptType(promptContext);

            const registry = this.promptSystem.getRegistry();
            const prompt = await registry.getPrompt(promptType);

            if (!prompt) {
                const availableTypes = Array.from(registry.getAllPrompts().keys());
                let errorMessage: string;
                
                if (availableTypes.length > 0) {
                    errorMessage = `No JSON prompt available for type '${promptType}'. Available prompt types: ${availableTypes.join(', ')}. Please ensure the required prompt template is properly configured.`;
                } else {
                    errorMessage = `No JSON prompt available. Please ensure prompt templates are properly configured and available in the templates directory.`;
                }
                
                // Log the error with comprehensive context
                promptErrorHandler.handleError(PromptError.PROMPT_NOT_FOUND, {
                    requestedType: promptType,
                    availableTypes: availableTypes,
                    action: action,
                    context: {
                        filePath: context.filePath,
                        language: context.language,
                        hasSelectedText: !!context.selectedText
                    },
                    suggestions: availableTypes.length > 0 
                        ? [`Use one of the available prompt types: ${availableTypes.join(', ')}`, 'Check prompt template configuration']
                        : ['Verify prompt templates are installed', 'Check templates directory exists', 'Ensure prompt files are valid JSON']
                });
                
                throw new Error(errorMessage);
            }

            // 3. Validate the prompt before processing
            const validation = this.promptValidator.validatePrompt(prompt);
            if (!validation.isValid) {
                const errorMessage = `Prompt validation failed for '${prompt.id}': ${validation.errors.join(', ')}. Please check the prompt template structure and required fields.`;
                
                promptErrorHandler.handleError(PromptError.VALIDATION_ERROR, {
                    promptId: prompt.id,
                    promptType: promptType,
                    errors: validation.errors,
                    warnings: validation.warnings,
                    suggestions: [
                        'Check prompt template JSON structure',
                        'Verify all required fields are present',
                        'Validate template syntax and variables'
                    ]
                });
                
                throw new Error(errorMessage);
            }

            // 4. Prepare variables for template substitution
            const variables = this.prepareVariables(promptContext, context, prompt.id);

            // 5. Process the template with variables
            const processedPrompt = this.templateEngine.processTemplate(prompt, variables);

            return processedPrompt;
        } catch (error) {
            // Log the error but re-throw the original specific error
            promptErrorHandler.handleError(PromptError.TEMPLATE_PARSE_ERROR, { action, context });
            throw error;
        }
    }

    /**
     * Load prompts (delegates to PromptSystem)
     */
    public async loadPrompts(): Promise<void> {
        await this.promptSystem.initialize();
    }

    /**
     * Validate prompt integrity using comprehensive validation
     */
    public validatePromptIntegrity(): any[] {
        const registry = this.promptSystem.getRegistry();
        const prompts = registry.getAllPrompts();
        const results: any[] = [];

        for (const [name, prompt] of Array.from(prompts.entries())) {
            try {
                // Use the comprehensive prompt validator
                const validation = this.promptValidator.validatePrompt(prompt);
                results.push({
                    name,
                    isValid: validation.isValid,
                    errors: validation.errors,
                    warnings: validation.warnings
                });

                // Log validation issues
                if (!validation.isValid) {
                    promptErrorHandler.logError(
                        PromptError.VALIDATION_ERROR,
                        `Prompt '${name}' failed validation`,
                        { errors: validation.errors, warnings: validation.warnings }
                    );
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
                results.push({
                    name,
                    isValid: false,
                    errors: [errorMessage],
                    warnings: []
                });

                promptErrorHandler.logError(
                    PromptError.VALIDATION_ERROR,
                    `Exception during validation of prompt '${name}'`,
                    { error: errorMessage }
                );
            }
        }

        return results;
    }

    /**
     * Prepare variables for template substitution
     */
    private prepareVariables(promptContext: any, context: CodeContext, promptId: string): VariableMap {
        const config = this.configManager.getPromptConfig(promptId);
        const globalSettings = this.configManager.getGlobalSettings();

        // Base variables from context
        const variables: VariableMap = {
            // Code context
            code: context.selectedText || context.fullText || '',
            selectedCode: context.selectedText || '',
            fullCode: context.fullText || '',
            filePath: context.filePath || '',
            fileName: context.filePath ? context.filePath.split('/').pop() : '',
            language: promptContext.language || 'plaintext',
            
            // Error context
            errorMessage: context.errorMessage || '',
            errorSource: context.diagnostics?.[0]?.source || '',
            errorSeverity: context.diagnostics?.[0]?.severity || '',
            errorLine: context.lineNumber || 0,
            errorColumn: context.columnNumber || 0,
            
            // Surrounding context
            surroundingCode: context.surroundingCode || '',
            lineNumber: context.lineNumber || 0,
            columnNumber: context.columnNumber || 0,
            
            // Configuration
            experienceLevel: globalSettings.experienceLevel,
            maxSuggestions: globalSettings.maxSuggestions,
            outputVerbosity: globalSettings.outputVerbosity,
            includeExplanations: globalSettings.includeExplanations,
            
            // Prompt-specific config
            focusAreas: config.customSettings?.focus_areas || globalSettings.customFocusAreas,
            severityThreshold: config.customSettings?.severity_threshold || 'medium',
            
            // Project context
            projectType: promptContext.projectContext?.projectType || 'general',
            framework: promptContext.projectContext?.framework || '',
            
            // Metadata
            timestamp: new Date().toISOString(),
            action: promptContext.action
        };

        if (promptContext.language) {
            variables.languageSpecificCriteria = this.getLanguageSpecificCriteria(promptContext.language);
        }

        variables.experienceLevelGuidance = this.getExperienceLevelGuidance(globalSettings.experienceLevel);

        return variables;
    }

    /**
     * Get language-specific criteria for code review
     */
    private getLanguageSpecificCriteria(language: string): string {
        const criteria: Record<string, string[]> = {
            javascript: [
                'Check for proper async/await usage',
                'Validate event listener cleanup',
                'Review closure usage and memory leaks',
                'Check for proper error handling in promises'
            ],
            typescript: [
                'Verify type safety and proper typing',
                'Check for any usage and type assertions',
                'Review interface vs type usage',
                'Validate generic constraints'
            ],
            python: [
                'Check PEP 8 compliance',
                'Review exception handling patterns',
                'Validate list comprehensions vs loops',
                'Check for proper context manager usage'
            ],
            java: [
                'Review exception handling hierarchy',
                'Check for proper resource management',
                'Validate thread safety considerations',
                'Review design pattern implementations'
            ]
        };

        const langCriteria = criteria[language.toLowerCase()];
        return langCriteria ? langCriteria.join('\n- ') : 'Apply general code quality principles';
    }

    /**
     * Get experience level guidance
     */
    private getExperienceLevelGuidance(level: string): string {
        const guidance: Record<string, string> = {
            beginner: 'Provide detailed explanations with learning resources. Focus on fundamental concepts and common pitfalls. Include step-by-step solutions.',
            intermediate: 'Balance explanation depth with practical advice. Reference best practices and design patterns. Provide alternative approaches.',
            advanced: 'Focus on architectural concerns, performance implications, and edge cases. Reference advanced patterns and trade-offs.'
        };

        return guidance[level] || guidance.intermediate;
    }



    /**
     * Check if the manager is initialized
     */
    public isInitialized(): boolean {
        return this.initialized;
    }

    /**
     * Get available prompt types
     */
    public getAvailablePromptTypes(): string[] {
        const registry = this.promptSystem.getRegistry();
        const prompts = registry.getAllPrompts();
        return Array.from(prompts.keys());
    }

    /**
     * Get the prompt system instance (for testing purposes)
     */
    public getPromptSystem(): PromptSystem {
        return this.promptSystem;
    }

    /**
     * Get system statistics including performance metrics
     */
    public getStats() {
        return {
            initialized: this.initialized,
            promptSystem: this.promptSystem.getStats(),
            templateEngine: this.templateEngine.getPerformanceMetrics(),
            errorStats: promptErrorHandler.getErrorStats(),
            recoveryCapabilities: promptErrorHandler.validateRecoveryCapabilities()
        };
    }

    /**
     * Optimize system performance
     */
    public optimizePerformance(): void {
        // Optimize template engine caches
        this.templateEngine.optimizeCaches();
        
        // Optimize prompt registry
        const registry = this.promptSystem.getRegistry();
        registry.optimizeMemory();
        
        promptErrorHandler.logError(
            PromptError.CONFIGURATION_ERROR,
            'System performance optimization completed',
            { stats: this.getStats() }
        );
    }

    /**
     * Setup error handling callbacks and monitoring
     */
    private setupErrorHandling(): void {
        promptErrorHandler.onError((error, message, context) => {
            // Log to VS Code output channel if available
            if (vscode?.window) {
                const outputChannel = vscode.window.createOutputChannel('DebugBuddy Prompt System');
                outputChannel.appendLine(`[${new Date().toISOString()}] ${error}: ${message}`);
                
                if (context) {
                    outputChannel.appendLine(`Context: ${JSON.stringify(context, null, 2)}`);
                }
            }

            if (promptErrorHandler.isErrorFrequent(error, 10)) {
                this.handleFrequentError(error);
            }
        });
    }

    /**
     * Handle frequently occurring errors
     */
    private handleFrequentError(error: PromptError): void {
        switch (error) {
            case PromptError.TEMPLATE_PARSE_ERROR:
                promptErrorHandler.logError(
                    PromptError.CONFIGURATION_ERROR,
                    'Frequent template parse errors detected. Consider reloading prompts or checking template files.',
                    { suggestion: 'reload_prompts' }
                );
                break;

            case PromptError.VALIDATION_ERROR:
                promptErrorHandler.logError(
                    PromptError.CONFIGURATION_ERROR,
                    'Frequent validation errors detected. Prompt templates may be corrupted.',
                    { suggestion: 'validate_all_prompts' }
                );
                break;

            case PromptError.VARIABLE_SUBSTITUTION_ERROR:
                promptErrorHandler.logError(
                    PromptError.CONFIGURATION_ERROR,
                    'Frequent variable substitution errors. Check template variable definitions.',
                    { suggestion: 'check_variable_definitions' }
                );
                break;
        }
    }

    /**
     * Perform system health check
     */
    public performHealthCheck(): {
        healthy: boolean;
        issues: string[];
        recommendations: string[];
    } {
        const issues: string[] = [];
        const recommendations: string[] = [];

        if (!this.initialized) {
            issues.push('PromptManager not initialized');
            recommendations.push('Call initialize() before using the prompt system');
        }

        const registry = this.promptSystem.getRegistry();
        const promptCount = registry.getAllPrompts().size;
        if (promptCount === 0) {
            issues.push('No prompts loaded');
            recommendations.push('Load prompt templates from the templates directory');
        }

        const validationResults = this.validatePromptIntegrity();
        const invalidCount = validationResults.filter(r => !r.isValid).length;
        if (invalidCount > 0) {
            issues.push(`${invalidCount} invalid prompts detected`);
            recommendations.push('Fix or remove invalid prompt templates');
        }

        const recoveryCheck = promptErrorHandler.validateRecoveryCapabilities();
        if (!recoveryCheck.canRecover) {
            issues.push(...recoveryCheck.issues);
            recommendations.push('Address error handling issues to improve system reliability');
        }

        return {
            healthy: issues.length === 0,
            issues,
            recommendations
        };
    }
}