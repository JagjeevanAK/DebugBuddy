/**
 * Template engine for processing JSON prompts with variable substitution
 */

import { ITemplateEngine } from './interfaces';
import { JsonPrompt, VariableMap, ProcessedPrompt, ValidationResult, PromptError } from './types';
import { promptErrorHandler, withErrorHandling } from './ErrorHandler';

export class TemplateEngine implements ITemplateEngine {
    private static readonly VARIABLE_PATTERN = /\$\{([^}]+)\}/g;
    private static readonly NESTED_PROPERTY_SEPARATOR = '.';

    /**
     * Process a prompt template with variable substitution
     */
    processTemplate(prompt: JsonPrompt, variables: VariableMap): ProcessedPrompt {
        // Validate the template first
        const validation = this.validateTemplate(prompt.template);
        if (!validation.isValid) {
            promptErrorHandler.handleError(PromptError.VALIDATION_ERROR, {
                promptId: prompt.id,
                errors: validation.errors
            });
            throw new Error(`Template processing failed: ${validation.errors.join(', ')}`);
        }

        return withErrorHandling(() => {
            // Deep clone the template to avoid modifying the original
            const processedTemplate = this.deepClone(prompt.template);
            const variablesUsed: string[] = [];

            // Process the template recursively with error handling
            try {
                this.processObject(processedTemplate, variables, variablesUsed);
            } catch (error) {
                promptErrorHandler.handleError(PromptError.VARIABLE_SUBSTITUTION_ERROR, {
                    promptId: prompt.id,
                    variables: Object.keys(variables),
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
                throw error;
            }

            const allVariables = [...variablesUsed];
            if (prompt.template.variables && Array.isArray(prompt.template.variables)) {
                allVariables.push(...prompt.template.variables);
            }
            // Also include all variables that were provided (available for substitution)
            allVariables.push(...Object.keys(variables));

            return {
                content: processedTemplate,
                metadata: prompt.metadata || {},
                variables_used: Array.from(new Set(allVariables)) // Remove duplicates
            };
        }, PromptError.TEMPLATE_PARSE_ERROR, { promptId: prompt.id }) || {
            content: {},
            metadata: {},
            variables_used: []
        };
    }

    /**
     * Validate a prompt template structure
     */
    validateTemplate(template: any): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        if (!template) {
            errors.push('Template is null or undefined');
            return { isValid: false, errors, warnings };
        }

        if (typeof template.task !== 'string' || !template.task.trim()) {
            errors.push('Template task cannot be empty');
        }

        if (typeof template.instructions !== 'string' || !template.instructions.trim()) {
            errors.push('Template must have non-empty instructions field');
        }

        if (!template.context || typeof template.context !== 'object') {
            errors.push('Template must have a context object');
        }

        if (!template.output_format || typeof template.output_format !== 'object') {
            errors.push('Template must have an output_format object');
        }

        if (!Array.isArray(template.variables)) {
            warnings.push('Template should have a variables array listing expected variables');
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Substitute variables in a template string
     */
    substituteVariables(template: string, variables: VariableMap): string {
        if (typeof template !== 'string') {
            return template;
        }

        return template.replace(TemplateEngine.VARIABLE_PATTERN, (match, variablePath) => {
            const value = this.resolveNestedVariable(variablePath.trim(), variables);
            
            const pathExists = this.variablePathExists(variablePath.trim(), variables);
            
            if (!pathExists) {
                return match;
            }

            return this.valueToString(value);
        });
    }

    /**
     * Process an object recursively, substituting variables in all string values
     */
    private processObject(obj: any, variables: VariableMap, variablesUsed: string[]): void {
        if (obj === null || obj === undefined) {
            return;
        }

        if (typeof obj === 'string') {
            // This shouldn't happen in normal object traversal, but handle it
            return;
        }

        if (Array.isArray(obj)) {
            for (let i = 0; i < obj.length; i++) {
                if (typeof obj[i] === 'string') {
                    const original = obj[i];
                    obj[i] = this.substituteVariables(obj[i], variables);
                    this.trackUsedVariables(original, variablesUsed);
                } else if (typeof obj[i] === 'object') {
                    this.processObject(obj[i], variables, variablesUsed);
                }
            }
        } else if (typeof obj === 'object') {
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    if (typeof obj[key] === 'string') {
                        const original = obj[key];
                        obj[key] = this.substituteVariables(obj[key], variables);
                        this.trackUsedVariables(original, variablesUsed);
                    } else if (typeof obj[key] === 'object') {
                        this.processObject(obj[key], variables, variablesUsed);
                    }
                }
            }
        }
    }

    /**
     * Resolve nested variable paths like "user.name" or "error.details.message"
     */
    private resolveNestedVariable(variablePath: string, variables: VariableMap): any {
        const parts = variablePath.split(TemplateEngine.NESTED_PROPERTY_SEPARATOR);
        let current = variables;

        for (const part of parts) {
            if (current === null || current === undefined || typeof current !== 'object') {
                return undefined;
            }
            current = current[part];
        }

        return current;
    }

    /**
     * Check if a variable path exists in the variables object
     */
    private variablePathExists(variablePath: string, variables: VariableMap): boolean {
        const parts = variablePath.split(TemplateEngine.NESTED_PROPERTY_SEPARATOR);
        let current = variables;

        for (const part of parts) {
            if (current === null || current === undefined || typeof current !== 'object') {
                return false;
            }
            if (!(part in current)) {
                return false;
            }
            current = current[part];
        }

        return true;
    }

    /**
     * Convert a value to its string representation for template substitution
     */
    private valueToString(value: any): string {
        if (value === null) {
            return 'null';
        }
        if (value === undefined) {
            return 'undefined';
        }
        if (typeof value === 'string') {
            return value;
        }
        if (typeof value === 'number' || typeof value === 'boolean') {
            return String(value);
        }
        if (typeof value === 'object') {
            try {
                return JSON.stringify(value, null, 2);
            } catch {
                return '[Object]';
            }
        }
        return String(value);
    }

    /**
     * Track which variables were used during substitution
     */
    private trackUsedVariables(template: string, variablesUsed: string[]): void {
        const matches = template.match(TemplateEngine.VARIABLE_PATTERN);
        if (matches) {
            for (const match of matches) {
                const variablePath = match.slice(2, -1).trim(); // Remove ${ and }
                variablesUsed.push(variablePath);
            }
        }
    }

    /**
     * Deep clone an object to avoid modifying the original
     */
    private deepClone(obj: any): any {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }

        if (obj instanceof Date) {
            return new Date(obj.getTime());
        }

        if (Array.isArray(obj)) {
            return obj.map(item => this.deepClone(item));
        }

        const cloned: any = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                cloned[key] = this.deepClone(obj[key]);
            }
        }

        return cloned;
    }
}