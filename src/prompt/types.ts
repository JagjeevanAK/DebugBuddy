/**
 * Core types and interfaces for the JSON prompt system
 */

export enum PromptCategory {
    CODE_REVIEW = 'code_review',
    DEBUG_ANALYSIS = 'debug_analysis',
    REFACTORING = 'refactoring',
    DOCUMENTATION = 'documentation',
    SECURITY_ANALYSIS = 'security_analysis',
    PERFORMANCE_ANALYSIS = 'performance_analysis',
    CODE_EXPLANATION = 'code_explanation',
    GENERAL = 'general'
}

export enum UserAction {
    CODE_REVIEW = 'code_review',
    DEBUG_ERROR = 'debug_error',
    REFACTOR = 'refactor',
    GENERATE_DOCS = 'generate_docs',
    SECURITY_ANALYSIS = 'security_analysis',
    PERFORMANCE_ANALYSIS = 'performance_analysis',
    EXPLAIN_CODE = 'explain_code'
}

export interface OutputFormat {
    structure: string;
    include_line_numbers?: boolean;
    include_severity?: boolean;
    include_explanation?: boolean;
    include_fix_suggestion?: boolean;
}

export interface PromptTemplate {
    task: string;
    language?: string;
    context: Record<string, any>;
    instructions: string;
    output_format: OutputFormat;
    variables: string[];
}

export interface PromptConfig {
    configurable_fields: string[];
    default_values: Record<string, any>;
    validation_rules: Record<string, any>;
    focus_areas?: string[];
    severity_threshold?: string;
}

export interface PromptMetadata {
    supported_languages?: string[];
    required_context?: string[];
    performance_notes?: string;
    legacy?: boolean;
}

export interface JsonPrompt {
    id: string;
    name: string;
    description: string;
    category: PromptCategory;
    version: string;
    author?: string;
    created_date?: string;
    last_modified?: string;
    template: PromptTemplate;
    config: PromptConfig;
    metadata?: PromptMetadata;
    schema_version: string;
}

export interface VariableMap {
    [key: string]: any;
}

export interface ProcessedPrompt {
    content: object;
    metadata: PromptMetadata;
    variables_used: string[];
}

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

export interface PromptContext {
    action: UserAction;
    language: string;
    hasError: boolean;
    errorType?: string;
    codeSelection?: string;
    fileType: string;
    projectContext?: ProjectContext;
}

export interface ProjectContext {
    framework?: string;
    projectType?: string;
    customRules?: string[];
}

export interface CodeContext {
    filePath?: string;
    lineNumber?: number;
    columnNumber?: number;
    selectedText?: string;
    fullText?: string;
    surroundingCode?: string;
    language?: string;
    errorMessage?: string;
    diagnostics?: any[];
}

export interface GlobalPromptSettings {
    experienceLevel: 'beginner' | 'intermediate' | 'advanced';
    maxSuggestions: number;
    includeExplanations: boolean;
    customFocusAreas: string[];
    outputVerbosity: 'minimal' | 'standard' | 'detailed';
}

export enum PromptError {
    TEMPLATE_PARSE_ERROR = 'template_parse_error',
    VARIABLE_SUBSTITUTION_ERROR = 'variable_substitution_error',
    VALIDATION_ERROR = 'validation_error',
    CONFIGURATION_ERROR = 'configuration_error',
    PROMPT_NOT_FOUND = 'prompt_not_found'
}

export interface FallbackStrategy {
    useSimplePrompt: boolean;
    fallbackPromptId?: string;
    errorMessage?: string;
}