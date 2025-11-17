import { JsonPrompt, ValidationResult, VariableMap, ProcessedPrompt, PromptContext, UserAction, CodeContext, PromptConfig, GlobalPromptSettings, PromptError, FallbackStrategy } from './types';

export interface IPromptRegistry {
    registerPrompt(name: string, prompt: JsonPrompt): void;
    getPrompt(name: string): Promise<JsonPrompt | null>;
    getAllPrompts(): Map<string, JsonPrompt>;
    reloadPrompts(): Promise<void>;
    hasPrompt(name: string): boolean;
    unregisterPrompt(name: string): boolean;
    getPromptsByCategory(category: string): JsonPrompt[];
}

export interface IPromptLoader {
    loadPromptsFromDirectory(directory: string): Promise<JsonPrompt[]>;
    loadPromptFromFile(filePath: string): Promise<JsonPrompt>;
    validatePromptFile(filePath: string): Promise<ValidationResult>;
    scanCustomDirectories(directories: string[]): Promise<Map<string, JsonPrompt[]>>;
    watchDirectory(directory: string, callback: (eventType: string, filename: string) => void): any;
    getDirectoryMetadata(directory: string): Promise<{
        exists: boolean;
        readable: boolean;
        promptFiles: number;
        totalFiles: number;
        lastModified: Date | null;
        size: number;
    }>;
}

export interface ITemplateEngine {
    processTemplate(prompt: JsonPrompt, variables: VariableMap): ProcessedPrompt;
    validateTemplate(template: any): ValidationResult;
    substituteVariables(template: string, variables: VariableMap): string;
}

export interface IContextAnalyzer {
    analyzeContext(action: UserAction, context: CodeContext): PromptContext;
    determinePromptType(context: PromptContext): string;
}

export interface IConfigurationManager {
    getPromptConfig(promptId: string): PromptConfig;
    updatePromptConfig(promptId: string, config: Partial<PromptConfig>): void;
    getGlobalSettings(): GlobalPromptSettings;
    onConfigurationChange(callback: (config: any) => void): void;
}

export interface IPromptValidator {
    validatePrompt(prompt: JsonPrompt): ValidationResult;
    validateTemplate(template: any): ValidationResult;
    validateConfig(config: PromptConfig): ValidationResult;
}

export interface IPromptManager {
    processRequest(action: UserAction, context: CodeContext): Promise<ProcessedPrompt>;
    loadPrompts(): Promise<void>;
    validatePromptIntegrity(): ValidationResult[];
    getAvailablePromptTypes(): string[];
}

export interface IErrorHandler {
    handleError(error: PromptError, context: any): FallbackStrategy;
    logError(error: PromptError, message: string, context?: any): void;
}