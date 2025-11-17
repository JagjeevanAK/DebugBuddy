export enum UserAction {
    CODE_REVIEW = 'code_review',
    DEBUG_ERROR = 'debug_error',
    REFACTOR = 'refactor',
    GENERATE_DOCS = 'generate_docs',
    SECURITY_ANALYSIS = 'security_analysis',
    PERFORMANCE_ANALYSIS = 'performance_analysis',
    EXPLAIN_CODE = 'explain_code'
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

export interface VariableMap {
    [key: string]: any;
}

export interface PromptMetadata {
    promptId?: string;
    action?: UserAction;
    language?: string;
    supported_languages?: string[];
    required_context?: string[];
    performance_notes?: string;
}

export interface ProcessedPrompt {
    content: object;
    metadata: PromptMetadata;
    variables_used: string[];
}

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
    metadata?: Record<string, any>;
    schema_version: string;
}