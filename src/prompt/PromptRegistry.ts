/**
 * PromptRegistry - Central registry for managing JSON prompt templates
 */

import { IPromptRegistry } from './interfaces';
import { JsonPrompt, PromptCategory } from './types';

export class PromptRegistry implements IPromptRegistry {
    private prompts: Map<string, JsonPrompt> = new Map();
    private promptsByCategory: Map<PromptCategory, JsonPrompt[]> = new Map();

    constructor() {
        Object.values(PromptCategory).forEach(category => {
            this.promptsByCategory.set(category, []);
        });
    }

    /**
     * Register a new prompt in the registry
     */
    registerPrompt(name: string, prompt: JsonPrompt): void {
        if (!name || !prompt) {
            throw new Error('Invalid prompt name or prompt object');
        }

        if (!prompt.id) {
            throw new Error('Prompt must have an id');
        }

        // Store by both name and id for flexibility
        this.prompts.set(name, prompt);
        this.prompts.set(prompt.id, prompt);

        const categoryPrompts = this.promptsByCategory.get(prompt.category) || [];
        const existingIndex = categoryPrompts.findIndex(p => p.id === prompt.id);
        
        if (existingIndex >= 0) {
            categoryPrompts[existingIndex] = prompt;
        } else {
            categoryPrompts.push(prompt);
        }
        
        this.promptsByCategory.set(prompt.category, categoryPrompts);
    }

    async getPrompt(key: string): Promise<JsonPrompt | null> {
        return this.prompts.get(key) || null;
    }

    /**
     * Synchronous version of getPrompt for backward compatibility
     */
    getPromptSync(name: string): JsonPrompt | null {
        return this.prompts.get(name) || null;
    }

    /**
     * Get all registered prompts
     */
    getAllPrompts(): Map<string, JsonPrompt> {
        return new Map(this.prompts);
    }

    /**
     * Check if a prompt exists
     */
    hasPrompt(name: string): boolean {
        return this.prompts.has(name);
    }

    /**
     * Remove a prompt from the registry
     */
    unregisterPrompt(name: string): boolean {
        const prompt = this.prompts.get(name);
        if (!prompt) {
            return false;
        }

        this.prompts.delete(name);
        this.prompts.delete(prompt.id);

        const categoryPrompts = this.promptsByCategory.get(prompt.category) || [];
        const filteredPrompts = categoryPrompts.filter(p => p.id !== prompt.id);
        this.promptsByCategory.set(prompt.category, filteredPrompts);

        return true;
    }

    /**
     * Get prompts by category
     */
    getPromptsByCategory(category: string): JsonPrompt[] {
        const promptCategory = category as PromptCategory;
        return this.promptsByCategory.get(promptCategory) || [];
    }

    /**
     * Reload all prompts from storage
     * This is a placeholder - actual implementation will be handled by PromptLoader
     */
    async reloadPrompts(): Promise<void> {
        // Clear existing prompts
        this.prompts.clear();
        Object.values(PromptCategory).forEach(category => {
            this.promptsByCategory.set(category, []);
        });

        // This method is an interface for external reload requests; PromptLoader will provide the concrete implementation
        // This method serves as the interface for external reload requests
    }

    /**
     * Get registry statistics
     */
    getStats(): { totalPrompts: number; promptsByCategory: Record<string, number> } {
        const stats = {
            totalPrompts: this.prompts.size / 2, // Divide by 2 since we store by both name and id
            promptsByCategory: {} as Record<string, number>
        };

        this.promptsByCategory.forEach((prompts, category) => {
            stats.promptsByCategory[category] = prompts.length;
        });

        return stats;
    }

    /**
     * Clear all prompts from the registry
     */
    clear(): void {
        this.prompts.clear();
        Object.values(PromptCategory).forEach(category => {
            this.promptsByCategory.set(category, []);
        });
    }

    /**
     * Get all prompt names
     */
    getPromptNames(): string[] {
        const names = new Set<string>();
        this.prompts.forEach((prompt, key) => {
            // Only add the name, not the id (avoid duplicates)
            if (key !== prompt.id) {
                names.add(key);
            }
        });
        return Array.from(names);
    }

    getPromptIds(): string[] {
        const ids = new Set<string>();
        this.prompts.forEach((prompt) => {
            ids.add(prompt.id);
        });
        return Array.from(ids);
    }
}