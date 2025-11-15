/**
 * PromptSystem - Main entry point for the JSON prompt system
 * Provides initialization and coordination of all prompt system components
 */

import { PromptRegistry } from './PromptRegistry';
import { PromptLoader } from './PromptLoader';
import { PromptHotReloader } from './PromptHotReloader';
import { ValidationUtils } from './ValidationUtils';
import { TemplateComposition } from './TemplateComposition';
import { JsonPrompt, PromptCategory } from './types';
import * as path from 'path';
import * as fs from 'fs';

export class PromptSystem {
    private static instance: PromptSystem;
    private registry: PromptRegistry;
    private loader: PromptLoader;
    private hotReloader: PromptHotReloader;
    private validationUtils: ValidationUtils;
    private templateComposition: TemplateComposition;
    private initialized: boolean = false;
    private customDirectories: string[] = [];

    private constructor() {
        this.registry = new PromptRegistry();
        this.loader = new PromptLoader();
        this.validationUtils = new ValidationUtils();
        this.templateComposition = new TemplateComposition();
        this.hotReloader = new PromptHotReloader();
    }

    /**
     * Get the singleton instance of PromptSystem
     */
    public static getInstance(): PromptSystem {
        if (!PromptSystem.instance) {
            PromptSystem.instance = new PromptSystem();
        }
        return PromptSystem.instance;
    }

    /**
     * Initialize the prompt system
     */
    public async initialize(customDirectories: string[] = []): Promise<void> {
        if (this.initialized) {
            return;
        }

        try {
            await this.loadBuiltInPrompts();
            
            // Load custom prompts from specified directories
            this.customDirectories = customDirectories;
            if (customDirectories.length > 0) {
                await this.loadCustomPrompts(customDirectories);
            }
            
            this.initialized = true;
        } catch (error) {
            console.error('Failed to initialize prompt system:', error);
            throw error;
        }
    }

    /**
     * Get the prompt registry
     */
    public getRegistry(): PromptRegistry {
        return this.registry;
    }

    /**
     * Load built-in prompt templates
     */
    private async loadBuiltInPrompts(): Promise<void> {
        // When bundled with esbuild, __dirname points to dist/
        // Templates are copied to dist/templates by the build script
        const templatesDir = path.join(__dirname, 'templates');
        
        try {
            // Check if templates directory exists
            if (!fs.existsSync(templatesDir)) {
                console.warn(`Templates directory not found at: ${templatesDir}`);
                return;
            }

            // Load JSON prompt files (exclude schema files)
            const files = fs.readdirSync(templatesDir);
            const jsonFiles = files.filter(file => file.endsWith('.json') && !file.includes('schema'));

            for (const file of jsonFiles) {
                try {
                    const filePath = path.join(templatesDir, file);
                    const content = fs.readFileSync(filePath, 'utf8');
                    const prompt: JsonPrompt = JSON.parse(content);
                    
                    // Basic validation
                    if (this.isValidPrompt(prompt)) {
                        this.registry.registerPrompt(prompt.id, prompt);
                        this.registry.registerPrompt(prompt.name, prompt);
                    } else {
                        console.warn(`Invalid prompt structure in file: ${file}`);
                    }
                } catch (error) {
                    console.error(`Failed to load prompt from ${file}:`, error);
                }
            }
        } catch (error) {
            console.error('Failed to read templates directory:', error);
        }
    }

    /**
     * Basic validation for prompt structure
     */
    private isValidPrompt(prompt: any): prompt is JsonPrompt {
        return (
            prompt &&
            typeof prompt.id === 'string' &&
            typeof prompt.name === 'string' &&
            typeof prompt.description === 'string' &&
            typeof prompt.category === 'string' &&
            typeof prompt.version === 'string' &&
            prompt.template &&
            typeof prompt.template.task === 'string' &&
            typeof prompt.template.instructions === 'string' &&
            Array.isArray(prompt.template.variables) &&
            prompt.config &&
            Array.isArray(prompt.config.configurable_fields) &&
            typeof prompt.schema_version === 'string'
        );
    }

    /**
     * Check if the system is initialized
     */
    public isInitialized(): boolean {
        return this.initialized;
    }

    /**
     * Reset the prompt system (useful for testing)
     */
    public reset(): void {
        this.registry.clear();
        this.initialized = false;
    }

    /**
     * Load custom prompts from directories
     */
    private async loadCustomPrompts(directories: string[]): Promise<void> {
        const customPrompts = await this.loader.scanCustomDirectories(directories);
        
        for (const [directory, prompts] of customPrompts) {
            for (const prompt of prompts) {
                // Apply template composition if needed
                const composedPrompt = await this.templateComposition.composePrompt(prompt);
                
                // Register the prompt
                this.registry.registerPrompt(composedPrompt.id, composedPrompt);
                this.registry.registerPrompt(composedPrompt.name, composedPrompt);
                
                // Register as base template for inheritance
                this.templateComposition.registerBaseTemplate(composedPrompt);
            }
        }
    }

    /**
     * Enable hot reloading for custom directories
     */
    public enableHotReload(directories: string[] = this.customDirectories): void {
        this.hotReloader.enable(directories, true);
    }

    /**
     * Disable hot reloading
     */
    public disableHotReload(): void {
        this.hotReloader.disable();
    }

    /**
     * Get validation utilities
     */
    public getValidationUtils(): ValidationUtils {
        return this.validationUtils;
    }

    /**
     * Get template composition engine
     */
    public getTemplateComposition(): TemplateComposition {
        return this.templateComposition;
    }

    /**
     * Get hot reloader
     */
    public getHotReloader(): PromptHotReloader {
        return this.hotReloader;
    }

    /**
     * Validate all loaded prompts
     */
    public async validateAllPrompts(): Promise<any> {
        const directories = [
            path.join(__dirname, 'templates'),
            ...this.customDirectories
        ];
        
        return await this.validationUtils.validateDirectories(directories);
    }

    /**
     * Reload prompts from all sources
     */
    public async reloadAllPrompts(): Promise<void> {
        this.registry.clear();
        this.templateComposition.clearCache();
        
        await this.loadBuiltInPrompts();
        
        if (this.customDirectories.length > 0) {
            await this.loadCustomPrompts(this.customDirectories);
        }
    }

    /**
     * Add custom directory
     */
    public addCustomDirectory(directory: string): void {
        if (!this.customDirectories.includes(directory)) {
            this.customDirectories.push(directory);
        }
    }

    /**
     * Remove custom directory
     */
    public removeCustomDirectory(directory: string): void {
        const index = this.customDirectories.indexOf(directory);
        if (index > -1) {
            this.customDirectories.splice(index, 1);
        }
    }

    /**
     * Get system statistics
     */
    public getStats() {
        return {
            initialized: this.initialized,
            customDirectories: this.customDirectories.length,
            hotReload: this.hotReloader.getStatus(),
            composition: this.templateComposition.getStats(),
            ...this.registry.getStats()
        };
    }
}