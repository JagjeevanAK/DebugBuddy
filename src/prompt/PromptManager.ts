import * as fs from 'fs';
import * as path from 'path';
import { UserAction, CodeContext, ProcessedPrompt, VariableMap, JsonPrompt } from './types';

export class PromptManager {
    private static instance: PromptManager;
    private prompts: Map<string, JsonPrompt> = new Map();
    private initialized = false;

    private constructor() {}

    static getInstance(): PromptManager {
        if (!PromptManager.instance) {
            PromptManager.instance = new PromptManager();
        }
        return PromptManager.instance;
    }

    async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        const templatesDir = path.join(__dirname, 'templates');
        const files = fs.readdirSync(templatesDir).filter(f => f.endsWith('.json') && f !== 'schema.json');

        for (const file of files) {
            try {
                const content = fs.readFileSync(path.join(templatesDir, file), 'utf8');
                const prompt = JSON.parse(content) as JsonPrompt;
                this.prompts.set(prompt.id, prompt);
            } catch (error) {
                console.error(`Failed to load prompt ${file}:`, error);
            }
        }

        this.initialized = true;
    }

    async processRequest(action: UserAction, context: CodeContext): Promise<ProcessedPrompt> {
        const promptId = this.getPromptId(action);
        const prompt = this.prompts.get(promptId);

        if (!prompt) {
            throw new Error(`Prompt not found: ${promptId}`);
        }

        const variables: VariableMap = {
            selectedCode: context.selectedText || context.fullText,
            surroundingCode: context.surroundingCode || context.selectedText || context.fullText,
            language: context.language || 'plaintext',
            filePath: context.filePath || 'unknown',
            errorMessage: context.errorMessage || '',
            errorLine: context.lineNumber?.toString() || '',
            stackTrace: '',
            errorType: 'runtime'
        };

        if (prompt.config?.default_values) {
            for (const [key, value] of Object.entries(prompt.config.default_values)) {
                if (!variables[key]) {
                    variables[key] = value;
                }
            }
        }

        return {
            content: this.substituteVariables(prompt.template, variables),
            metadata: {
                promptId: prompt.id,
                action,
                language: context.language
            },
            variables_used: Object.keys(variables)
        };
    }

    private getPromptId(action: UserAction): string {
        const mapping: Record<UserAction, string> = {
            [UserAction.CODE_REVIEW]: 'code-review',
            [UserAction.DEBUG_ERROR]: 'debug-analysis',
            [UserAction.REFACTOR]: 'refactoring',
            [UserAction.GENERATE_DOCS]: 'documentation',
            [UserAction.SECURITY_ANALYSIS]: 'security-analysis',
            [UserAction.PERFORMANCE_ANALYSIS]: 'performance-analysis',
            [UserAction.EXPLAIN_CODE]: 'code-review'
        };
        return mapping[action];
    }

    private substituteVariables(template: any, variables: VariableMap): any {
        if (typeof template === 'string') {
            return template.replace(/\$\{([^}]+)\}/g, (_, key) => {
                return variables[key.trim()] || '';
            });
        }

        if (Array.isArray(template)) {
            return template.map(item => this.substituteVariables(item, variables));
        }

        if (typeof template === 'object' && template !== null) {
            const result: any = {};
            for (const [key, value] of Object.entries(template)) {
                result[key] = this.substituteVariables(value, variables);
            }
            return result;
        }

        return template;
    }

    getAvailablePromptTypes(): string[] {
        return Array.from(this.prompts.keys());
    }

    getStats() {
        return {
            totalPrompts: this.prompts.size,
            initialized: this.initialized
        };
    }
}
