/**
 * PromptValidator - Validates JSON prompt templates and configurations
 */

import { IPromptValidator } from './interfaces';
import { JsonPrompt, ValidationResult, PromptConfig, PromptCategory, PromptTemplate } from './types';

export class PromptValidator implements IPromptValidator {
    private static readonly REQUIRED_PROMPT_FIELDS = ['id', 'name', 'description', 'category', 'template', 'config', 'schema_version'];
    private static readonly REQUIRED_TEMPLATE_FIELDS = ['task', 'instructions', 'context', 'output_format', 'variables'];
    private static readonly REQUIRED_CONFIG_FIELDS = ['configurable_fields', 'default_values', 'validation_rules'];
    private static readonly SUPPORTED_SCHEMA_VERSIONS = ['1.0', '1.1'];
    private static readonly MAX_FIELD_LENGTH = 10000;
    private static readonly MAX_VARIABLES = 50;

    /**
     * Validate a complete JSON prompt structure
     */
    validatePrompt(prompt: JsonPrompt): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        try {
            if (!prompt) {
                errors.push('Prompt is null or undefined');
                return { isValid: false, errors, warnings };
            }

            this.validateRequiredFields(prompt, PromptValidator.REQUIRED_PROMPT_FIELDS, errors);
            this.validatePromptFields(prompt, errors, warnings);

            if (prompt.template) {
                const templateValidation = this.validateTemplate(prompt.template);
                errors.push(...templateValidation.errors);
                warnings.push(...templateValidation.warnings);
            }

            if (prompt.config) {
                const configValidation = this.validateConfig(prompt.config);
                errors.push(...configValidation.errors);
                warnings.push(...configValidation.warnings);
            }

            this.validateTemplateConfigConsistency(prompt, errors, warnings);

        } catch (error) {
            errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Validate prompt template structure and content
     */
    validateTemplate(template: any): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        if (!template) {
            errors.push('Template is null or undefined');
            return { isValid: false, errors, warnings };
        }

        this.validateRequiredFields(template, PromptValidator.REQUIRED_TEMPLATE_FIELDS, errors);
        this.validateTemplateFields(template, errors, warnings);
        this.validateVariableReferences(template, errors, warnings);

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Validate prompt configuration structure
     */
    validateConfig(config: PromptConfig): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        if (!config) {
            errors.push('Config is null or undefined');
            return { isValid: false, errors, warnings };
        }

        this.validateRequiredFields(config, PromptValidator.REQUIRED_CONFIG_FIELDS, errors);
        this.validateConfigFields(config, errors, warnings);

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Validate that required fields are present
     */
    private validateRequiredFields(obj: any, requiredFields: string[], errors: string[]): void {
        for (const field of requiredFields) {
            if (!(field in obj) || obj[field] === null || obj[field] === undefined) {
                errors.push(`Missing required field: ${field}`);
            }
        }
    }

    /**
     * Validate prompt-level fields
     */
    private validatePromptFields(prompt: JsonPrompt, errors: string[], warnings: string[]): void {
        if (prompt.id && typeof prompt.id === 'string') {
            if (!/^[a-zA-Z0-9_-]+$/.test(prompt.id)) {
                errors.push('Prompt ID must contain only alphanumeric characters, underscores, and hyphens');
            }
            if (prompt.id.length > 100) {
                errors.push('Prompt ID must be 100 characters or less');
            }
        } else if (prompt.id !== undefined) {
            errors.push('Prompt ID must be a string');
        }

        if (prompt.name && typeof prompt.name === 'string') {
            if (prompt.name.length > 200) {
                errors.push('Prompt name must be 200 characters or less');
            }
            if (prompt.name.trim().length === 0) {
                errors.push('Prompt name cannot be empty');
            }
        } else if (prompt.name !== undefined) {
            errors.push('Prompt name must be a string');
        }

        if (prompt.description && typeof prompt.description === 'string') {
            if (prompt.description.length > 1000) {
                warnings.push('Prompt description is very long (>1000 characters)');
            }
        } else if (prompt.description !== undefined) {
            errors.push('Prompt description must be a string');
        }

        if (prompt.category !== undefined) {
            if (!Object.values(PromptCategory).includes(prompt.category)) {
                errors.push(`Invalid prompt category: ${prompt.category}. Must be one of: ${Object.values(PromptCategory).join(', ')}`);
            }
        }

        if (prompt.schema_version && typeof prompt.schema_version === 'string') {
            if (!PromptValidator.SUPPORTED_SCHEMA_VERSIONS.includes(prompt.schema_version)) {
                warnings.push(`Unsupported schema version: ${prompt.schema_version}. Supported versions: ${PromptValidator.SUPPORTED_SCHEMA_VERSIONS.join(', ')}`);
            }
        } else if (prompt.schema_version !== undefined) {
            errors.push('Schema version must be a string');
        }

        if (prompt.version && typeof prompt.version === 'string') {
            if (!/^\d+\.\d+(\.\d+)?$/.test(prompt.version)) {
                warnings.push('Version should follow semantic versioning format (e.g., 1.0.0)');
            }
        } else if (prompt.version !== undefined) {
            errors.push('Version must be a string');
        }

        if (prompt.created_date && !this.isValidDateString(prompt.created_date)) {
            warnings.push('Created date is not in a valid format');
        }
        if (prompt.last_modified && !this.isValidDateString(prompt.last_modified)) {
            warnings.push('Last modified date is not in a valid format');
        }
    }

    /**
     * Validate template-specific fields
     */
    private validateTemplateFields(template: PromptTemplate, errors: string[], warnings: string[]): void {
        if (template.task !== undefined) {
            if (typeof template.task === 'string') {
                if (template.task.trim().length === 0) {
                    errors.push('Template task cannot be empty');
                }
                if (template.task.length > PromptValidator.MAX_FIELD_LENGTH) {
                    errors.push(`Template task is too long (max ${PromptValidator.MAX_FIELD_LENGTH} characters)`);
                }
            } else {
                errors.push('Template task must be a string');
            }
        }

        if (template.instructions !== undefined) {
            if (typeof template.instructions === 'string') {
                if (template.instructions.trim().length === 0) {
                    errors.push('Template instructions cannot be empty');
                }
                if (template.instructions.length > PromptValidator.MAX_FIELD_LENGTH) {
                    errors.push(`Template instructions are too long (max ${PromptValidator.MAX_FIELD_LENGTH} characters)`);
                }
            } else {
                errors.push('Template instructions must be a string');
            }
        }

        if (template.context !== undefined) {
            if (typeof template.context !== 'object' || template.context === null) {
                errors.push('Template context must be an object');
            } else {
                this.validateContextObject(template.context, errors, warnings);
            }
        }

        if (template.output_format !== undefined) {
            if (typeof template.output_format !== 'object' || template.output_format === null) {
                errors.push('Template output_format must be an object');
            } else {
                this.validateOutputFormat(template.output_format, errors, warnings);
            }
        }

        if (template.variables !== undefined) {
            if (!Array.isArray(template.variables)) {
                errors.push('Template variables must be an array');
            } else {
                this.validateVariablesArray(template.variables, errors, warnings);
            }
        }

        if (template.language && typeof template.language !== 'string') {
            errors.push('Template language must be a string');
        }
    }

    /**
     * Validate configuration fields
     */
    private validateConfigFields(config: PromptConfig, errors: string[], warnings: string[]): void {
        if (config.configurable_fields !== undefined) {
            if (!Array.isArray(config.configurable_fields)) {
                errors.push('Config configurable_fields must be an array');
            } else {
                for (const field of config.configurable_fields) {
                    if (typeof field !== 'string') {
                        errors.push('All configurable_fields must be strings');
                        break;
                    }
                }
            }
        }

        if (config.default_values !== undefined) {
            if (typeof config.default_values !== 'object' || config.default_values === null) {
                errors.push('Config default_values must be an object');
            }
        }

        if (config.validation_rules !== undefined) {
            if (typeof config.validation_rules !== 'object' || config.validation_rules === null) {
                errors.push('Config validation_rules must be an object');
            }
        }

        if (config.focus_areas && !Array.isArray(config.focus_areas)) {
            errors.push('Config focus_areas must be an array');
        }

        if (config.severity_threshold && typeof config.severity_threshold !== 'string') {
            errors.push('Config severity_threshold must be a string');
        }
    }

    /**
     * Validate context object structure
     */
    private validateContextObject(context: Record<string, any>, errors: string[], warnings: string[]): void {
        const contextKeys = Object.keys(context);
        if (contextKeys.length === 0) {
            warnings.push('Template context is empty');
        }

        if (this.getObjectDepth(context) > 5) {
            warnings.push('Template context has very deep nesting (>5 levels)');
        }
    }

    /**
     * Validate output format structure
     */
    private validateOutputFormat(outputFormat: any, errors: string[], warnings: string[]): void {
        if (!outputFormat.structure || typeof outputFormat.structure !== 'string') {
            errors.push('Output format must have a structure field that is a string');
        }

        const booleanFields = ['include_line_numbers', 'include_severity', 'include_explanation', 'include_fix_suggestion'];
        for (const field of booleanFields) {
            if (outputFormat[field] !== undefined && typeof outputFormat[field] !== 'boolean') {
                errors.push(`Output format ${field} must be a boolean`);
            }
        }
    }

    /**
     * Validate variables array
     */
    private validateVariablesArray(variables: any[], errors: string[], warnings: string[]): void {
        if (variables.length > PromptValidator.MAX_VARIABLES) {
            warnings.push(`Template has many variables (${variables.length}), consider simplifying`);
        }

        for (let i = 0; i < variables.length; i++) {
            if (typeof variables[i] !== 'string') {
                errors.push(`Variable at index ${i} must be a string`);
            } else if (variables[i].trim().length === 0) {
                errors.push(`Variable at index ${i} cannot be empty`);
            }
        }

        const uniqueVariables = new Set(variables);
        if (uniqueVariables.size !== variables.length) {
            warnings.push('Template has duplicate variables');
        }
    }

    /**
     * Validate variable references in template content
     */
    private validateVariableReferences(template: PromptTemplate, errors: string[], warnings: string[]): void {
        const declaredVariables = new Set(template.variables || []);
        const usedVariables = new Set<string>();

        this.extractVariablesFromObject(template, usedVariables);

        for (const usedVar of Array.from(usedVariables)) {
            if (!declaredVariables.has(usedVar)) {
                warnings.push(`Variable '${usedVar}' is used but not declared in variables array`);
            }
        }

        for (const declaredVar of Array.from(declaredVariables)) {
            if (!usedVariables.has(declaredVar)) {
                warnings.push(`Variable '${declaredVar}' is declared but not used in template`);
            }
        }
    }

    /**
     * Validate consistency between template and config
     */
    private validateTemplateConfigConsistency(prompt: JsonPrompt, errors: string[], warnings: string[]): void {
        if (!prompt.template || !prompt.config) {
            return;
        }

        const configurableFields = prompt.config.configurable_fields || [];
        for (const field of configurableFields) {
            if (!this.fieldExistsInTemplate(field, prompt.template)) {
                warnings.push(`Configurable field '${field}' not found in template`);
            }
        }

        const defaultValues = prompt.config.default_values || {};
        for (const key of Object.keys(defaultValues)) {
            if (!configurableFields.includes(key)) {
                warnings.push(`Default value for '${key}' but field is not configurable`);
            }
        }
    }

    /**
     * Extract variable references from template object
     */
    private extractVariablesFromObject(obj: any, variables: Set<string>): void {
        if (typeof obj === 'string') {
            const matches = obj.match(/\$\{([^}]+)\}/g);
            if (matches) {
                for (const match of matches) {
                    const variableName = match.slice(2, -1).trim();
                    const rootVariable = variableName.split('.')[0];
                    variables.add(rootVariable);
                }
            }
        } else if (Array.isArray(obj)) {
            for (const item of obj) {
                this.extractVariablesFromObject(item, variables);
            }
        } else if (typeof obj === 'object' && obj !== null) {
            for (const value of Object.values(obj)) {
                this.extractVariablesFromObject(value, variables);
            }
        }
    }

    /**
     * Check if a field exists in the template structure
     */
    private fieldExistsInTemplate(fieldPath: string, template: PromptTemplate): boolean {
        const parts = fieldPath.split('.');
        let current: any = template;

        for (const part of parts) {
            if (typeof current !== 'object' || current === null || !(part in current)) {
                return false;
            }
            current = current[part];
        }

        return true;
    }

    /**
     * Check if a string is a valid date
     */
    private isValidDateString(dateString: string): boolean {
        const date = new Date(dateString);
        return !isNaN(date.getTime());
    }

    /**
     * Get the maximum depth of an object
     */
    private getObjectDepth(obj: any, currentDepth: number = 0): number {
        if (typeof obj !== 'object' || obj === null) {
            return currentDepth;
        }

        let maxDepth = currentDepth;
        for (const value of Object.values(obj)) {
            const depth = this.getObjectDepth(value, currentDepth + 1);
            maxDepth = Math.max(maxDepth, depth);
        }

        return maxDepth;
    }
}