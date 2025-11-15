/**
 * TemplateComposition - Handles prompt template inheritance and composition
 */

import { JsonPrompt, PromptTemplate, PromptConfig, ValidationResult, PromptError } from './types';
import { PromptValidator } from './PromptValidator';
import { promptErrorHandler, withAsyncErrorHandling } from './ErrorHandler';
import * as path from 'path';

export interface InheritanceConfig {
    extends?: string;
    overrides?: Partial<PromptTemplate>;
    mixins?: string[];
    composition?: CompositionRule[];
}

export interface CompositionRule {
    type: 'merge' | 'replace' | 'append' | 'prepend';
    target: string;
    source?: string;
    value?: any;
}

export interface ComposedPrompt extends JsonPrompt {
    inheritance?: {
        parent?: string;
        mixins?: string[];
        compositionApplied: boolean;
        inheritanceChain: string[];
    };
}

export interface TemplateFragment {
    id: string;
    name: string;
    description: string;
    fragment: Partial<PromptTemplate>;
    variables?: string[];
    dependencies?: string[];
}

export class TemplateComposition {
    private validator: PromptValidator;
    private baseTemplates: Map<string, JsonPrompt> = new Map();
    private fragments: Map<string, TemplateFragment> = new Map();
    private compositionCache: Map<string, ComposedPrompt> = new Map();

    constructor() {
        this.validator = new PromptValidator();
    }

    /**
     * Register a base template for inheritance
     */
    registerBaseTemplate(template: JsonPrompt): void {
        this.baseTemplates.set(template.id, template);
        
        // Clear cache for templates that might inherit from this one
        this.clearRelatedCache(template.id);
    }

    /**
     * Register a template fragment for composition
     */
    registerFragment(fragment: TemplateFragment): void {
        this.fragments.set(fragment.id, fragment);
        
        // Clear cache since fragments might affect existing compositions
        this.compositionCache.clear();
    }

    /**
     * Compose a prompt with inheritance and mixins
     */
    async composePrompt(prompt: JsonPrompt, inheritanceConfig?: InheritanceConfig): Promise<ComposedPrompt> {
        const cacheKey = this.getCacheKey(prompt, inheritanceConfig);
        
        if (this.compositionCache.has(cacheKey)) {
            return this.compositionCache.get(cacheKey)!;
        }

        const result = await withAsyncErrorHandling(async () => {
            const composed = await this.performComposition(prompt, inheritanceConfig);
            this.compositionCache.set(cacheKey, composed);
            return composed;
        }, PromptError.TEMPLATE_PARSE_ERROR, { promptId: prompt.id, inheritanceConfig });

        if (!result) {
            throw new Error(`Failed to compose prompt: ${prompt.id}`);
        }

        return result;
    }

    /**
     * Perform the actual composition logic
     */
    private async performComposition(prompt: JsonPrompt, inheritanceConfig?: InheritanceConfig): Promise<ComposedPrompt> {
        const composed: ComposedPrompt = {
            ...prompt,
            inheritance: {
                compositionApplied: false,
                inheritanceChain: []
            }
        };

        const config = inheritanceConfig || this.extractInheritanceConfig(prompt);

        if (!config) {
            composed.inheritance!.compositionApplied = true;
            return composed;
        }

        // Apply inheritance
        if (config.extends) {
            await this.applyInheritance(composed, config.extends);
        }

        // Apply mixins
        if (config.mixins && config.mixins.length > 0) {
            await this.applyMixins(composed, config.mixins);
        }

        // Apply composition rules
        if (config.composition && config.composition.length > 0) {
            await this.applyCompositionRules(composed, config.composition);
        }

        // Apply overrides
        if (config.overrides) {
            this.applyOverrides(composed, config.overrides);
        }

        // Validate the composed result
        const validation = this.validator.validatePrompt(composed);
        if (!validation.isValid) {
            promptErrorHandler.handleError(PromptError.VALIDATION_ERROR, {
                promptId: composed.id,
                errors: validation.errors,
                operation: 'compose_prompt'
            });
        }

        composed.inheritance!.compositionApplied = true;
        return composed;
    }

    /**
     * Apply inheritance from a parent template
     */
    private async applyInheritance(composed: ComposedPrompt, parentId: string): Promise<void> {
        const parent = this.baseTemplates.get(parentId);
        if (!parent) {
            throw new Error(`Parent template not found: ${parentId}`);
        }

        if (composed.inheritance!.inheritanceChain.includes(parentId)) {
            throw new Error(`Circular inheritance detected: ${parentId}`);
        }

        composed.inheritance!.parent = parentId;
        composed.inheritance!.inheritanceChain.push(parentId);

        // If parent also has inheritance, compose it first
        const parentInheritanceConfig = this.extractInheritanceConfig(parent);
        let resolvedParent = parent;
        
        if (parentInheritanceConfig) {
            resolvedParent = await this.composePrompt(parent, parentInheritanceConfig);
        }

        // Merge parent template into composed template
        this.mergeTemplates(composed, resolvedParent);
    }

    /**
     * Apply mixins to the template
     */
    private async applyMixins(composed: ComposedPrompt, mixinIds: string[]): Promise<void> {
        composed.inheritance!.mixins = mixinIds;

        for (const mixinId of mixinIds) {
            const fragment = this.fragments.get(mixinId);
            if (!fragment) {
                promptErrorHandler.logError(
                    PromptError.TEMPLATE_PARSE_ERROR,
                    `Mixin fragment not found: ${mixinId}`,
                    { promptId: composed.id, mixinId }
                );
                continue;
            }

            if (fragment.dependencies) {
                for (const dep of fragment.dependencies) {
                    if (!this.fragments.has(dep) && !this.baseTemplates.has(dep)) {
                        throw new Error(`Mixin dependency not found: ${dep} (required by ${mixinId})`);
                    }
                }
            }

            // Apply the fragment
            this.applyFragment(composed, fragment);
        }
    }

    /**
     * Apply composition rules
     */
    private async applyCompositionRules(composed: ComposedPrompt, rules: CompositionRule[]): Promise<void> {
        for (const rule of rules) {
            try {
                await this.applyCompositionRule(composed, rule);
            } catch (error) {
                promptErrorHandler.handleError(PromptError.TEMPLATE_PARSE_ERROR, {
                    promptId: composed.id,
                    rule,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
    }

    /**
     * Apply a single composition rule
     */
    private async applyCompositionRule(composed: ComposedPrompt, rule: CompositionRule): Promise<void> {
        const targetPath = rule.target.split('.');
        let target = composed.template as any;

        // Navigate to the target location
        for (let i = 0; i < targetPath.length - 1; i++) {
            if (!target[targetPath[i]]) {
                target[targetPath[i]] = {};
            }
            target = target[targetPath[i]];
        }

        const finalKey = targetPath[targetPath.length - 1];
        let sourceValue = rule.value;

        if (rule.source) {
            sourceValue = this.getValueFromPath(composed.template, rule.source);
        }

        // Apply the rule based on type
        switch (rule.type) {
            case 'replace':
                target[finalKey] = sourceValue;
                break;

            case 'merge':
                if (typeof target[finalKey] === 'object' && typeof sourceValue === 'object') {
                    target[finalKey] = { ...target[finalKey], ...sourceValue };
                } else {
                    target[finalKey] = sourceValue;
                }
                break;

            case 'append':
                if (typeof target[finalKey] === 'string' && typeof sourceValue === 'string') {
                    target[finalKey] += sourceValue;
                } else if (Array.isArray(target[finalKey]) && Array.isArray(sourceValue)) {
                    target[finalKey].push(...sourceValue);
                } else {
                    target[finalKey] = sourceValue;
                }
                break;

            case 'prepend':
                if (typeof target[finalKey] === 'string' && typeof sourceValue === 'string') {
                    target[finalKey] = sourceValue + target[finalKey];
                } else if (Array.isArray(target[finalKey]) && Array.isArray(sourceValue)) {
                    target[finalKey] = [...sourceValue, ...target[finalKey]];
                } else {
                    target[finalKey] = sourceValue;
                }
                break;
        }
    }

    /**
     * Apply template overrides
     */
    private applyOverrides(composed: ComposedPrompt, overrides: Partial<PromptTemplate>): void {
        composed.template = { ...composed.template, ...overrides };
    }

    /**
     * Merge parent template into child template
     */
    private mergeTemplates(child: ComposedPrompt, parent: JsonPrompt): void {
        // Merge template fields
        child.template = {
            ...parent.template,
            ...child.template,
            // Special handling for arrays and objects
            variables: this.mergeArrays(parent.template.variables, child.template.variables),
            context: { ...parent.template.context, ...child.template.context },
            output_format: { ...parent.template.output_format, ...child.template.output_format }
        };

        // Merge config
        child.config = {
            ...parent.config,
            ...child.config,
            configurable_fields: this.mergeArrays(
                parent.config.configurable_fields,
                child.config.configurable_fields
            ),
            default_values: { ...parent.config.default_values, ...child.config.default_values },
            validation_rules: { ...parent.config.validation_rules, ...child.config.validation_rules }
        };

        // Merge metadata
        if (parent.metadata) {
            child.metadata = { ...parent.metadata, ...child.metadata };
        }
    }

    /**
     * Apply a template fragment
     */
    private applyFragment(composed: ComposedPrompt, fragment: TemplateFragment): void {
        if (fragment.fragment.task) {
            composed.template.task = this.mergeStrings(composed.template.task, fragment.fragment.task);
        }

        if (fragment.fragment.instructions) {
            composed.template.instructions = this.mergeStrings(
                composed.template.instructions,
                fragment.fragment.instructions
            );
        }

        if (fragment.fragment.context) {
            composed.template.context = { ...composed.template.context, ...fragment.fragment.context };
        }

        if (fragment.fragment.output_format) {
            composed.template.output_format = {
                ...composed.template.output_format,
                ...fragment.fragment.output_format
            };
        }

        if (fragment.fragment.variables) {
            composed.template.variables = this.mergeArrays(
                composed.template.variables,
                fragment.fragment.variables
            );
        }

        if (fragment.variables) {
            composed.template.variables = this.mergeArrays(
                composed.template.variables,
                fragment.variables
            );
        }
    }

    /**
     * Extract inheritance configuration from prompt metadata
     */
    private extractInheritanceConfig(prompt: JsonPrompt): InheritanceConfig | null {
        if (prompt.metadata && (prompt.metadata as any).inheritance) {
            return (prompt.metadata as any).inheritance;
        }

        if (prompt.description.includes('@extends:')) {
            const match = prompt.description.match(/@extends:\s*([^\s]+)/);
            if (match) {
                return { extends: match[1] };
            }
        }

        return null;
    }

    /**
     * Get value from object path
     */
    private getValueFromPath(obj: any, path: string): any {
        const parts = path.split('.');
        let current = obj;

        for (const part of parts) {
            if (current && typeof current === 'object' && part in current) {
                current = current[part];
            } else {
                return undefined;
            }
        }

        return current;
    }

    /**
     * Merge two arrays, removing duplicates
     */
    private mergeArrays(arr1: string[] = [], arr2: string[] = []): string[] {
        const merged = [...arr1, ...arr2];
        return Array.from(new Set(merged));
    }

    /**
     * Merge two strings intelligently
     */
    private mergeStrings(str1: string, str2: string, separator: string = '\n\n'): string {
        if (!str1) {
            return str2;
        }
        if (!str2) {
            return str1;
        }
        
        // Avoid duplicate content
        if (str1.includes(str2) || str2.includes(str1)) {
            return str1.length > str2.length ? str1 : str2;
        }

        return str1 + separator + str2;
    }

    /**
     * Generate cache key for composition
     */
    private getCacheKey(prompt: JsonPrompt, config?: InheritanceConfig): string {
        const configStr = config ? JSON.stringify(config) : '';
        return `${prompt.id}:${prompt.version || '1.0.0'}:${configStr}`;
    }

    /**
     * Clear cache entries related to a template
     */
    private clearRelatedCache(templateId: string): void {
        const keysToDelete: string[] = [];
        
        for (const key of this.compositionCache.keys()) {
            if (key.includes(templateId)) {
                keysToDelete.push(key);
            }
        }

        for (const key of keysToDelete) {
            this.compositionCache.delete(key);
        }
    }

    /**
     * Validate inheritance chain for circular dependencies
     */
    validateInheritanceChain(promptId: string, visited: Set<string> = new Set()): ValidationResult {
        if (visited.has(promptId)) {
            return {
                isValid: false,
                errors: [`Circular inheritance detected: ${Array.from(visited).join(' -> ')} -> ${promptId}`],
                warnings: []
            };
        }

        const prompt = this.baseTemplates.get(promptId);
        if (!prompt) {
            return {
                isValid: false,
                errors: [`Template not found: ${promptId}`],
                warnings: []
            };
        }

        const config = this.extractInheritanceConfig(prompt);
        if (!config || !config.extends) {
            return { isValid: true, errors: [], warnings: [] };
        }

        visited.add(promptId);
        return this.validateInheritanceChain(config.extends, visited);
    }

    /**
     * Get composition statistics
     */
    getStats(): {
        baseTemplates: number;
        fragments: number;
        cachedCompositions: number;
        inheritanceChains: number;
    } {
        let inheritanceChains = 0;
        
        for (const template of this.baseTemplates.values()) {
            const config = this.extractInheritanceConfig(template);
            if (config && config.extends) {
                inheritanceChains++;
            }
        }

        return {
            baseTemplates: this.baseTemplates.size,
            fragments: this.fragments.size,
            cachedCompositions: this.compositionCache.size,
            inheritanceChains
        };
    }

    /**
     * Create a template fragment from a full template
     */
    createFragment(template: JsonPrompt, fragmentId: string, fields: (keyof PromptTemplate)[]): TemplateFragment {
        const fragment: Partial<PromptTemplate> = {};
        const variables: string[] = [];

        for (const field of fields) {
            if (template.template[field] !== undefined) {
                (fragment as any)[field] = template.template[field];
                
                if (field === 'variables' && Array.isArray(template.template[field])) {
                    variables.push(...(template.template[field] as string[]));
                }
            }
        }

        return {
            id: fragmentId,
            name: `Fragment from ${template.name}`,
            description: `Template fragment containing: ${fields.join(', ')}`,
            fragment,
            variables: Array.from(new Set(variables))
        };
    }

    /**
     * Clear all caches
     */
    clearCache(): void {
        this.compositionCache.clear();
    }

    /**
     * Export composition configuration for a prompt
     */
    exportCompositionConfig(prompt: ComposedPrompt): InheritanceConfig | null {
        if (!prompt.inheritance || !prompt.inheritance.compositionApplied) {
            return null;
        }

        const config: InheritanceConfig = {};

        if (prompt.inheritance.parent) {
            config.extends = prompt.inheritance.parent;
        }

        if (prompt.inheritance.mixins && prompt.inheritance.mixins.length > 0) {
            config.mixins = prompt.inheritance.mixins;
        }

        return Object.keys(config).length > 0 ? config : null;
    }
}