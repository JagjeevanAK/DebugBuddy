/**
 * PromptRegistry - Central registry for managing JSON prompt templates
 * Enhanced with performance optimizations and caching
 */

import { IPromptRegistry } from './interfaces';
import { JsonPrompt, PromptCategory } from './types';
import { PromptCache } from './PromptCache';
import { LazyPromptLoader } from './LazyPromptLoader';
import { PromptHotReloader } from './PromptHotReloader';
import { MemoryMonitor } from './MemoryMonitor';

export class PromptRegistry implements IPromptRegistry {
    private prompts: Map<string, JsonPrompt> = new Map();
    private promptsByCategory: Map<PromptCategory, JsonPrompt[]> = new Map();
    private cache: PromptCache;
    private lazyLoader: LazyPromptLoader;
    private hotReloader: PromptHotReloader;
    private memoryMonitor: MemoryMonitor;

    constructor() {
        // Initialize category maps
        Object.values(PromptCategory).forEach(category => {
            this.promptsByCategory.set(category, []);
        });

        // Initialize performance components
        this.cache = new PromptCache();
        this.lazyLoader = new LazyPromptLoader(this.cache);
        this.hotReloader = new PromptHotReloader(this.cache);
        this.memoryMonitor = MemoryMonitor.getInstance();

        // Register with memory monitor
        this.memoryMonitor.registerComponent('PromptRegistry', () => this.optimizeMemory());

        // Set up hot reloader callbacks
        this.hotReloader.onFileChange((event, prompt) => {
            if (prompt) {
                this.registerPrompt(prompt.id, prompt);
            } else if (event.type === 'deleted') {
                // Try to unregister by filename
                const fileName = require('path').basename(event.filePath, '.json');
                this.unregisterPrompt(fileName);
            }
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

    /**
     * Retrieve a prompt by name or id (with lazy loading support)
     */
    async getPrompt(name: string): Promise<JsonPrompt | null> {
        const inMemory = this.prompts.get(name);
        if (inMemory) {
            return inMemory;
        }

        // Try lazy loading
        const lazyLoaded = await this.lazyLoader.getPrompt(name);
        if (lazyLoaded) {
            // Register the lazy-loaded prompt
            this.registerPrompt(name, lazyLoaded);
            return lazyLoaded;
        }

        return null;
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

    /**
     * Get all prompt ids
     */
    getPromptIds(): string[] {
        const ids = new Set<string>();
        this.prompts.forEach((prompt) => {
            ids.add(prompt.id);
        });
        return Array.from(ids);
    }

    /**
     * Enable hot reloading for custom directories
     */
    enableHotReload(directories: string[]): void {
        this.hotReloader.enable(directories, true);
    }

    /**
     * Disable hot reloading
     */
    disableHotReload(): void {
        this.hotReloader.disable();
    }

    /**
     * Initialize lazy loading for directories
     */
    async initializeLazyLoading(directories: string[]): Promise<void> {
        await this.lazyLoader.initialize(directories);
        
        // Preload frequently used prompts
        await this.lazyLoader.preloadFrequentlyUsed();
        
        // Update memory monitor
        this.memoryMonitor.updateComponentUsage('PromptRegistry', this.cache.getMemoryUsageMB());
    }

    /**
     * Get performance statistics
     */
    getPerformanceStats(): {
        cacheStats: any;
        lazyLoaderStats: any;
        hotReloaderStatus: any;
        memoryUsage: number;
    } {
        return {
            cacheStats: this.cache.getStats(),
            lazyLoaderStats: this.lazyLoader.getStats(),
            hotReloaderStatus: this.hotReloader.getStatus(),
            memoryUsage: this.cache.getMemoryUsageMB()
        };
    }

    /**
     * Optimize memory usage
     */
    optimizeMemory(): void {
        this.cache.optimize();
        this.lazyLoader.optimizeMemory();
        
        // Update memory monitor
        this.memoryMonitor.updateComponentUsage('PromptRegistry', this.cache.getMemoryUsageMB());
    }

    /**
     * Preload specific prompts
     */
    async preloadPrompts(promptIds: string[]): Promise<void> {
        await this.lazyLoader.preloadPrompts(promptIds);
    }

    /**
     * Get cache health metrics
     */
    getCacheHealth(): any {
        return this.cache.getHealthMetrics();
    }

    /**
     * Clear all caches and reset
     */
    clearCaches(): void {
        this.cache.clear();
        this.lazyLoader.clear();
    }
}