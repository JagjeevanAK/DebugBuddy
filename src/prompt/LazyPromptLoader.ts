/**
 * LazyPromptLoader - Implements lazy loading for prompt templates
 * Only loads prompts when they are actually needed
 */

import * as fs from 'fs';
import * as path from 'path';
import { JsonPrompt, PromptError } from './types';
import { PromptCache } from './PromptCache';
import { PromptLoader } from './PromptLoader';
import { promptErrorHandler, withAsyncErrorHandling } from './ErrorHandler';

interface LazyPromptEntry {
    filePath: string;
    lastModified: number;
    loaded: boolean;
    loading: Promise<JsonPrompt> | null;
}

export class LazyPromptLoader {
    private promptLoader: PromptLoader;
    private cache: PromptCache;
    private lazyEntries: Map<string, LazyPromptEntry> = new Map();
    private loadingPromises: Map<string, Promise<JsonPrompt>> = new Map();

    constructor(cache?: PromptCache) {
        this.promptLoader = new PromptLoader();
        this.cache = cache || new PromptCache();
    }

    /**
     * Initialize lazy loading by scanning directories for prompt files
     */
    async initialize(directories: string[]): Promise<void> {
        const result = await withAsyncErrorHandling(async () => {
            for (const directory of directories) {
                await this.scanDirectory(directory);
            }

            promptErrorHandler.logError(
                PromptError.CONFIGURATION_ERROR,
                `Lazy loader initialized with ${this.lazyEntries.size} prompt entries`,
                { 
                    directories,
                    entryCount: this.lazyEntries.size,
                    entries: Array.from(this.lazyEntries.keys())
                }
            );
        }, PromptError.CONFIGURATION_ERROR, { directories });

        if (!result) {
            throw new Error('Failed to initialize lazy prompt loader');
        }
    }

    /**
     * Get a prompt, loading it lazily if needed
     */
    async getPrompt(key: string): Promise<JsonPrompt | null> {
        const cached = this.cache.get(key);
        if (cached) {
            return cached;
        }

        const lazyEntry = this.lazyEntries.get(key);
        if (!lazyEntry) {
            return null;
        }

        if (lazyEntry.loading) {
            return await lazyEntry.loading;
        }

        // Start loading
        const loadingPromise = this.loadPromptFromEntry(key, lazyEntry);
        lazyEntry.loading = loadingPromise;
        this.loadingPromises.set(key, loadingPromise);

        try {
            const prompt = await loadingPromise;
            lazyEntry.loaded = true;
            lazyEntry.loading = null;
            this.loadingPromises.delete(key);
            
            // Cache the loaded prompt
            this.cache.set(key, prompt);
            
            return prompt;
        } catch (error) {
            lazyEntry.loading = null;
            this.loadingPromises.delete(key);
            
            promptErrorHandler.handleError(PromptError.TEMPLATE_PARSE_ERROR, {
                key,
                filePath: lazyEntry.filePath,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            
            return null;
        }
    }

    /**
     * Check if a prompt is available (either loaded or can be loaded)
     */
    hasPrompt(key: string): boolean {
        return this.cache.has(key) || this.lazyEntries.has(key);
    }

    /**
     * Preload specific prompts
     */
    async preloadPrompts(keys: string[]): Promise<void> {
        const loadPromises = keys
            .filter(key => this.lazyEntries.has(key) && !this.cache.has(key))
            .map(key => this.getPrompt(key));

        await Promise.allSettled(loadPromises);

        promptErrorHandler.logError(
            PromptError.CONFIGURATION_ERROR,
            `Preloaded ${keys.length} prompts`,
            { keys, cacheSize: this.cache.getStats().entryCount }
        );
    }

    /**
     * Preload frequently used prompts based on usage patterns
     */
    async preloadFrequentlyUsed(): Promise<void> {
        const frequentlyUsed = [
            'code-review',
            'debug-analysis', 
            'refactoring',
            'documentation',
            'security-analysis'
        ];

        await this.preloadPrompts(frequentlyUsed);
    }

    /**
     * Get all available prompt keys
     */
    getAvailableKeys(): string[] {
        const cacheKeys = Array.from(this.cache.getStats().entryCount > 0 ? 
            new Set(Array.from(this.lazyEntries.keys())) : []);
        const lazyKeys = Array.from(this.lazyEntries.keys());
        
        return Array.from(new Set([...cacheKeys, ...lazyKeys]));
    }

    /**
     * Refresh a specific prompt if the file has been modified
     */
    async refreshPrompt(key: string): Promise<boolean> {
        const lazyEntry = this.lazyEntries.get(key);
        if (!lazyEntry) {
            return false;
        }

        try {
            const stats = await fs.promises.stat(lazyEntry.filePath);
            const fileModified = stats.mtime.getTime();

            if (fileModified > lazyEntry.lastModified) {
                // File has been modified, reload it
                this.cache.delete(key);
                lazyEntry.loaded = false;
                lazyEntry.lastModified = fileModified;

                // Load the updated prompt
                await this.getPrompt(key);
                
                promptErrorHandler.logError(
                    PromptError.CONFIGURATION_ERROR,
                    `Refreshed modified prompt: ${key}`,
                    { filePath: lazyEntry.filePath, lastModified: new Date(fileModified) }
                );
                
                return true;
            }
        } catch (error) {
            promptErrorHandler.handleError(PromptError.CONFIGURATION_ERROR, {
                key,
                filePath: lazyEntry.filePath,
                error: error instanceof Error ? error.message : 'Unknown error',
                operation: 'refresh_prompt'
            });
        }

        return false;
    }

    /**
     * Refresh all prompts that have been modified
     */
    async refreshModifiedPrompts(): Promise<string[]> {
        const refreshedKeys: string[] = [];
        const refreshPromises = Array.from(this.lazyEntries.keys()).map(async (key) => {
            const refreshed = await this.refreshPrompt(key);
            if (refreshed) {
                refreshedKeys.push(key);
            }
        });

        await Promise.allSettled(refreshPromises);
        
        if (refreshedKeys.length > 0) {
            promptErrorHandler.logError(
                PromptError.CONFIGURATION_ERROR,
                `Refreshed ${refreshedKeys.length} modified prompts`,
                { refreshedKeys }
            );
        }

        return refreshedKeys;
    }

    /**
     * Get loading statistics
     */
    getStats(): {
        totalEntries: number;
        loadedEntries: number;
        cacheStats: any;
        currentlyLoading: number;
        loadingKeys: string[];
    } {
        const loadedCount = Array.from(this.lazyEntries.values())
            .filter(entry => entry.loaded).length;

        return {
            totalEntries: this.lazyEntries.size,
            loadedEntries: loadedCount,
            cacheStats: this.cache.getStats(),
            currentlyLoading: this.loadingPromises.size,
            loadingKeys: Array.from(this.loadingPromises.keys())
        };
    }

    /**
     * Optimize memory usage by unloading least recently used prompts
     */
    optimizeMemory(): void {
        this.cache.optimize();
        
        // Optionally unload prompts that haven't been accessed recently
        const now = Date.now();
        const maxIdleTime = 30 * 60 * 1000; // 30 minutes
        
        for (const [key, entry] of this.lazyEntries) {
            if (entry.loaded && this.cache.has(key)) {
                const cacheEntry = this.cache.get(key);
                if (cacheEntry && (now - entry.lastModified) > maxIdleTime) {
                    this.cache.delete(key);
                    entry.loaded = false;
                }
            }
        }
    }

    /**
     * Scan a directory for prompt files and create lazy entries
     */
    private async scanDirectory(directory: string): Promise<void> {
        try {
            if (!fs.existsSync(directory)) {
                promptErrorHandler.logError(
                    PromptError.CONFIGURATION_ERROR,
                    `Directory does not exist: ${directory}`,
                    { directory }
                );
                return;
            }

            const files = await fs.promises.readdir(directory);
            const jsonFiles = files.filter(file => file.endsWith('.json'));

            for (const file of jsonFiles) {
                const filePath = path.join(directory, file);
                const stats = await fs.promises.stat(filePath);
                
                const key = path.basename(file, '.json');
                
                this.lazyEntries.set(key, {
                    filePath,
                    lastModified: stats.mtime.getTime(),
                    loaded: false,
                    loading: null
                });
            }

            promptErrorHandler.logError(
                PromptError.CONFIGURATION_ERROR,
                `Scanned directory: ${directory}, found ${jsonFiles.length} prompt files`,
                { directory, files: jsonFiles }
            );

        } catch (error) {
            promptErrorHandler.handleError(PromptError.CONFIGURATION_ERROR, {
                directory,
                error: error instanceof Error ? error.message : 'Unknown error',
                operation: 'scan_directory'
            });
        }
    }

    /**
     * Load a prompt from a lazy entry
     */
    private async loadPromptFromEntry(key: string, entry: LazyPromptEntry): Promise<JsonPrompt> {
        const result = await withAsyncErrorHandling(async () => {
            const prompt = await this.promptLoader.loadPromptFromFile(entry.filePath);
            
            promptErrorHandler.logError(
                PromptError.CONFIGURATION_ERROR,
                `Lazy loaded prompt: ${key}`,
                { filePath: entry.filePath, promptId: prompt.id }
            );
            
            return prompt;
        }, PromptError.TEMPLATE_PARSE_ERROR, { key, filePath: entry.filePath });

        if (!result) {
            throw new Error(`Failed to load prompt from ${entry.filePath}`);
        }

        return result;
    }

    /**
     * Clear all lazy entries and cache
     */
    clear(): void {
        this.lazyEntries.clear();
        this.loadingPromises.clear();
        this.cache.clear();
    }

    /**
     * Get memory usage information
     */
    getMemoryInfo(): {
        cacheMemoryMB: number;
        totalEntries: number;
        loadedEntries: number;
        memoryEfficiency: number;
    } {
        const stats = this.getStats();
        const cacheMemoryMB = this.cache.getMemoryUsageMB();
        const memoryEfficiency = stats.totalEntries > 0 ? 
            (stats.loadedEntries / stats.totalEntries) * 100 : 0;

        return {
            cacheMemoryMB,
            totalEntries: stats.totalEntries,
            loadedEntries: stats.loadedEntries,
            memoryEfficiency
        };
    }
}