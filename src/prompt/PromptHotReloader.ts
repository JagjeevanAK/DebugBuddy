/**
 * PromptHotReloader - Hot reloading system for prompt templates during development
 */

import * as fs from 'fs';
import * as path from 'path';
import { JsonPrompt, PromptError } from './types';
import { PromptLoader } from './PromptLoader';
import { PromptCache } from './PromptCache';
import { promptErrorHandler, withAsyncErrorHandling } from './ErrorHandler';

interface WatchedDirectory {
    path: string;
    watcher: fs.FSWatcher | null;
    recursive: boolean;
}

interface FileChangeEvent {
    type: 'added' | 'modified' | 'deleted';
    filePath: string;
    timestamp: number;
}

export class PromptHotReloader {
    private promptLoader: PromptLoader;
    private cache: PromptCache;
    private watchedDirectories: Map<string, WatchedDirectory> = new Map();
    private changeCallbacks: ((event: FileChangeEvent, prompt?: JsonPrompt) => void)[] = [];
    private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
    private debounceDelay: number = 500; // 500ms debounce
    private isEnabled: boolean = false;

    constructor(cache?: PromptCache) {
        this.promptLoader = new PromptLoader();
        this.cache = cache || new PromptCache();
    }

    /**
     * Enable hot reloading for specified directories
     */
    enable(directories: string[], recursive: boolean = false): void {
        if (this.isEnabled) {
            this.disable();
        }

        this.isEnabled = true;

        directories.forEach(directory => {
            this.watchDirectory(directory, recursive);
        });

        promptErrorHandler.logError(
            PromptError.CONFIGURATION_ERROR,
            `Hot reloading enabled for ${directories.length} directories`,
            { directories, recursive }
        );
    }

    /**
     * Disable hot reloading
     */
    disable(): void {
        if (!this.isEnabled) {
            return;
        }

        // Close all watchers
        this.watchedDirectories.forEach(watched => {
            if (watched.watcher) {
                watched.watcher.close();
            }
        });

        // Clear debounce timers
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();

        this.watchedDirectories.clear();
        this.isEnabled = false;

        promptErrorHandler.logError(
            PromptError.CONFIGURATION_ERROR,
            'Hot reloading disabled',
            {}
        );
    }

    /**
     * Add callback for file change events
     */
    onFileChange(callback: (event: FileChangeEvent, prompt?: JsonPrompt) => void): void {
        this.changeCallbacks.push(callback);
    }

    /**
     * Remove callback for file change events
     */
    removeFileChangeCallback(callback: (event: FileChangeEvent, prompt?: JsonPrompt) => void): void {
        const index = this.changeCallbacks.indexOf(callback);
        if (index > -1) {
            this.changeCallbacks.splice(index, 1);
        }
    }

    /**
     * Manually trigger reload for a specific file
     */
    async reloadFile(filePath: string): Promise<boolean> {
        if (!fs.existsSync(filePath) || !filePath.endsWith('.json')) {
            return false;
        }

        const result = await withAsyncErrorHandling(async () => {
            const prompt = await this.promptLoader.loadPromptFromFile(filePath);
            
            // Update cache
            this.cache.set(prompt.id, prompt);
            
            // Notify callbacks
            const event: FileChangeEvent = {
                type: 'modified',
                filePath,
                timestamp: Date.now()
            };
            
            this.notifyCallbacks(event, prompt);
            
            promptErrorHandler.logError(
                PromptError.CONFIGURATION_ERROR,
                `Manually reloaded prompt file: ${filePath}`,
                { promptId: prompt.id }
            );
            
            return true;
        }, PromptError.TEMPLATE_PARSE_ERROR, { filePath });

        return result || false;
    }

    /**
     * Get hot reloading status
     */
    getStatus(): {
        enabled: boolean;
        watchedDirectories: string[];
        callbackCount: number;
        pendingReloads: number;
    } {
        return {
            enabled: this.isEnabled,
            watchedDirectories: Array.from(this.watchedDirectories.keys()),
            callbackCount: this.changeCallbacks.length,
            pendingReloads: this.debounceTimers.size
        };
    }

    /**
     * Set debounce delay for file changes
     */
    setDebounceDelay(delayMs: number): void {
        this.debounceDelay = delayMs;
        
        promptErrorHandler.logError(
            PromptError.CONFIGURATION_ERROR,
            `Hot reloader debounce delay set to ${delayMs}ms`,
            { delayMs }
        );
    }

    /**
     * Watch a directory for changes
     */
    private watchDirectory(directory: string, recursive: boolean): void {
        if (!fs.existsSync(directory)) {
            promptErrorHandler.handleError(PromptError.CONFIGURATION_ERROR, {
                message: `Cannot watch non-existent directory: ${directory}`,
                directory
            });
            return;
        }

        try {
            const watcher = fs.watch(directory, { recursive }, (eventType, filename) => {
                if (!filename || !filename.endsWith('.json')) {
                    return;
                }

                const filePath = path.join(directory, filename);
                this.handleFileChange(eventType, filePath);
            });

            this.watchedDirectories.set(directory, {
                path: directory,
                watcher,
                recursive
            });

            promptErrorHandler.logError(
                PromptError.CONFIGURATION_ERROR,
                `Started watching directory: ${directory}`,
                { directory, recursive }
            );

        } catch (error) {
            promptErrorHandler.handleError(PromptError.CONFIGURATION_ERROR, {
                message: `Failed to watch directory: ${directory}`,
                directory,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Handle file system change events
     */
    private handleFileChange(eventType: string, filePath: string): void {
        // Clear existing debounce timer for this file
        const existingTimer = this.debounceTimers.get(filePath);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        // Set new debounce timer
        const timer = setTimeout(() => {
            this.processFileChange(eventType, filePath);
            this.debounceTimers.delete(filePath);
        }, this.debounceDelay);

        this.debounceTimers.set(filePath, timer);
    }

    /**
     * Process file change after debounce
     */
    private async processFileChange(eventType: string, filePath: string): Promise<void> {
        const result = await withAsyncErrorHandling(async () => {
            let changeType: FileChangeEvent['type'];
            let prompt: JsonPrompt | undefined;

            if (eventType === 'rename') {
                if (fs.existsSync(filePath)) {
                    changeType = 'added';
                    prompt = await this.promptLoader.loadPromptFromFile(filePath);
                    this.cache.set(prompt.id, prompt);
                } else {
                    changeType = 'deleted';
                    // Try to remove from cache (we don't know the ID, so this is best effort)
                    const fileName = path.basename(filePath, '.json');
                    this.cache.delete(fileName);
                }
            } else if (eventType === 'change') {
                changeType = 'modified';
                if (fs.existsSync(filePath)) {
                    prompt = await this.promptLoader.loadPromptFromFile(filePath);
                    this.cache.set(prompt.id, prompt);
                }
            } else {
                return; // Unknown event type
            }

            const event: FileChangeEvent = {
                type: changeType,
                filePath,
                timestamp: Date.now()
            };

            this.notifyCallbacks(event, prompt);

            promptErrorHandler.logError(
                PromptError.CONFIGURATION_ERROR,
                `Hot reloaded file: ${filePath} (${changeType})`,
                { filePath, changeType, promptId: prompt?.id }
            );

        }, PromptError.TEMPLATE_PARSE_ERROR, { eventType, filePath });

        if (!result) {
            promptErrorHandler.handleError(PromptError.TEMPLATE_PARSE_ERROR, {
                message: `Failed to process file change: ${filePath}`,
                eventType,
                filePath
            });
        }
    }

    /**
     * Notify all registered callbacks
     */
    private notifyCallbacks(event: FileChangeEvent, prompt?: JsonPrompt): void {
        this.changeCallbacks.forEach(callback => {
            try {
                callback(event, prompt);
            } catch (error) {
                promptErrorHandler.handleError(PromptError.CONFIGURATION_ERROR, {
                    message: 'Error in hot reload callback',
                    error: error instanceof Error ? error.message : 'Unknown error',
                    event
                });
            }
        });
    }

    /**
     * Validate all watched directories
     */
    validateWatchedDirectories(): {
        valid: string[];
        invalid: string[];
        issues: string[];
    } {
        const valid: string[] = [];
        const invalid: string[] = [];
        const issues: string[] = [];

        this.watchedDirectories.forEach((watched, directory) => {
            if (!fs.existsSync(directory)) {
                invalid.push(directory);
                issues.push(`Directory does not exist: ${directory}`);
            } else {
                try {
                    fs.accessSync(directory, fs.constants.R_OK);
                    valid.push(directory);
                } catch {
                    invalid.push(directory);
                    issues.push(`Directory is not readable: ${directory}`);
                }
            }

            if (!watched.watcher) {
                issues.push(`No active watcher for directory: ${directory}`);
            }
        });

        return { valid, invalid, issues };
    }

    /**
     * Get statistics about hot reloading activity
     */
    getStatistics(): {
        watchedDirectories: number;
        activeWatchers: number;
        pendingReloads: number;
        callbacksRegistered: number;
        recentActivity: FileChangeEvent[];
    } {
        const activeWatchers = Array.from(this.watchedDirectories.values())
            .filter(watched => watched.watcher !== null).length;

        // We intentionally omit tracking recentActivity to keep the hot-reloader memory-light.
        // This can be enabled by consumers if detailed audit trails are required.
        const recentActivity: FileChangeEvent[] = [];

        return {
            watchedDirectories: this.watchedDirectories.size,
            activeWatchers,
            pendingReloads: this.debounceTimers.size,
            callbacksRegistered: this.changeCallbacks.length,
            recentActivity
        };
    }

    /**
     * Cleanup resources
     */
    cleanup(): void {
        this.disable();
        this.changeCallbacks.length = 0;
    }

    /**
     * Test hot reloading by creating a temporary file
     */
    async testHotReloading(testDirectory: string): Promise<boolean> {
        if (!this.isEnabled) {
            return false;
        }

        const testFilePath = path.join(testDirectory, 'hot-reload-test.json');
        const testPrompt: JsonPrompt = {
            id: 'hot-reload-test',
            name: 'Hot Reload Test',
            description: 'Test prompt for hot reloading',
            category: 'general' as any,
            version: '1.0.0',
            schema_version: '1.0.0',
            template: {
                task: 'test',
                context: {},
                instructions: 'This is a test prompt',
                output_format: {
                    structure: 'test',
                    include_line_numbers: false,
                    include_severity: false,
                    include_explanation: false,
                    include_fix_suggestion: false
                },
                variables: []
            },
            config: {
                configurable_fields: [],
                default_values: {},
                validation_rules: {}
            }
        };

        try {
            await fs.promises.writeFile(testFilePath, JSON.stringify(testPrompt, null, 2));
            
            // Wait for hot reload to process
            await new Promise(resolve => setTimeout(resolve, this.debounceDelay + 100));
            
            const loaded = this.cache.get('hot-reload-test');
            
            // Clean up test file
            await fs.promises.unlink(testFilePath);
            
            return loaded !== null;
        } catch (error) {
            promptErrorHandler.handleError(PromptError.CONFIGURATION_ERROR, {
                message: 'Hot reload test failed',
                testFilePath,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return false;
        }
    }
}