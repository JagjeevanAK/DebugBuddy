/**
 * PromptLoader - Handles discovery and loading of JSON prompt files
 */

import * as fs from 'fs';
import * as path from 'path';
import { IPromptLoader } from './interfaces';
import { JsonPrompt, ValidationResult, PromptCategory, PromptError } from './types';
import { PromptValidator } from './PromptValidator';
import { promptErrorHandler, withAsyncErrorHandling } from './ErrorHandler';
import Ajv, { JSONSchemaType } from 'ajv';
import addFormats from 'ajv-formats';

export class PromptLoader implements IPromptLoader {
    private ajv: Ajv;
    private schema: any;
    private promptValidator: PromptValidator;

    constructor() {
        this.ajv = new Ajv({ allErrors: true });
        addFormats(this.ajv);
        this.promptValidator = new PromptValidator();
        this.loadSchema();
    }

    /**
     * Load the JSON schema for prompt validation
     */
    private loadSchema(): void {
        try {
            // Try multiple possible paths for the schema
            const possiblePaths = [
                path.join(__dirname, 'templates', 'schema.json'),
                path.join(__dirname, '..', 'prompt', 'templates', 'schema.json'),
                path.join(process.cwd(), 'src', 'prompt', 'templates', 'schema.json')
            ];

            let schemaContent: string | null = null;
            let foundPath: string | null = null;
            
            for (const schemaPath of possiblePaths) {
                try {
                    if (fs.existsSync(schemaPath)) {
                        schemaContent = fs.readFileSync(schemaPath, 'utf8');
                        foundPath = schemaPath;
                        break;
                    }
                } catch (err) {
                    // Continue to next path
                }
            }

            if (schemaContent) {
                this.schema = JSON.parse(schemaContent);
            } else {
                // Use fallback schema without throwing error
                this.schema = this.getBasicSchema();
            }
        } catch (error) {
            // Silently fall back to basic schema
            this.schema = this.getBasicSchema();
        }
    }

    /**
     * Fallback basic schema if schema.json is not available
     */
    private getBasicSchema(): any {
        return {
            type: 'object',
            required: ['id', 'name', 'description', 'category', 'version', 'template', 'config', 'schema_version'],
            properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                description: { type: 'string' },
                category: { type: 'string' },
                version: { type: 'string' },
                template: { type: 'object' },
                config: { type: 'object' },
                schema_version: { type: 'string' }
            }
        };
    }

    /**
     * Load prompts from the specified directory
     */
    async loadPromptsFromDirectory(directory: string): Promise<JsonPrompt[]> {
        const result = await withAsyncErrorHandling(async () => {
            const prompts: JsonPrompt[] = [];

            if (!fs.existsSync(directory)) {
                promptErrorHandler.logError(
                    PromptError.CONFIGURATION_ERROR,
                    `Prompt directory does not exist: ${directory}`,
                    { directory }
                );
                return prompts;
            }

            const files = await fs.promises.readdir(directory);
            const jsonFiles = files.filter(file => file.endsWith('.json'));

            for (const file of jsonFiles) {
                const filePath = path.join(directory, file);
                const promptResult = await withAsyncErrorHandling(
                    () => this.loadPromptFromFile(filePath),
                    PromptError.TEMPLATE_PARSE_ERROR,
                    { file: filePath }
                );

                if (promptResult) {
                    prompts.push(promptResult);
                } else {
                    promptErrorHandler.logError(
                        PromptError.TEMPLATE_PARSE_ERROR,
                        `Failed to load prompt from ${file}`,
                        { file: filePath }
                    );
                }
            }

            promptErrorHandler.logError(
                PromptError.CONFIGURATION_ERROR,
                `Loaded ${prompts.length} JSON prompts from ${directory}`,
                { 
                    directory, 
                    totalJsonFiles: jsonFiles.length, 
                    successfulLoads: prompts.length,
                    failedLoads: jsonFiles.length - prompts.length,
                    loadingMode: 'json_only'
                }
            );

            return prompts;
        }, PromptError.CONFIGURATION_ERROR, { directory });

        return result || [];
    }

    /**
     * Load a single prompt from file
     */
    async loadPromptFromFile(filePath: string): Promise<JsonPrompt> {
        try {
            if (!fs.existsSync(filePath)) {
                promptErrorHandler.handleError(PromptError.TEMPLATE_PARSE_ERROR, {
                    filePath,
                    originalError: `Prompt file does not exist: ${filePath}`,
                    suggestions: ['Verify the file path is correct', 'Check if the prompt template file was moved or deleted', 'Ensure the templates directory is properly configured']
                });
                throw new Error(`Prompt file does not exist: ${filePath}. Please verify the file path and ensure the prompt template is available.`);
            }

            const fileContent = await fs.promises.readFile(filePath, 'utf8');
            let promptData: any;

            try {
                promptData = JSON.parse(fileContent);
            } catch (parseError) {
                const parseErrorMessage = parseError instanceof Error ? parseError.message : 'Unknown parse error';
                promptErrorHandler.handleError(PromptError.TEMPLATE_PARSE_ERROR, {
                    filePath,
                    parseError: parseErrorMessage,
                    suggestions: ['Check JSON syntax for missing commas, brackets, or quotes', 'Validate the JSON structure using a JSON validator', 'Ensure the file encoding is UTF-8']
                });
                throw new Error(`Invalid JSON in prompt file ${filePath}: ${parseErrorMessage}. Please check the JSON syntax and structure.`);
            }

            // Ensure category is valid enum value before validation
            if (!Object.values(PromptCategory).includes(promptData.category)) {
                promptErrorHandler.logError(
                    PromptError.VALIDATION_ERROR,
                    `Unknown category '${promptData.category}' in ${filePath}, defaulting to 'general'`,
                    { originalCategory: promptData.category, filePath }
                );
                promptData.category = PromptCategory.GENERAL;
            }

            // Use comprehensive validation
            const validation = this.promptValidator.validatePrompt(promptData);
            if (!validation.isValid) {
                promptErrorHandler.handleError(PromptError.VALIDATION_ERROR, {
                    filePath,
                    errors: validation.errors,
                    warnings: validation.warnings,
                    suggestions: ['Check that all required fields are present', 'Verify field types match the schema', 'Ensure template variables are properly defined']
                });
                throw new Error(`Invalid prompt structure in ${filePath}: ${validation.errors.join(', ')}. Please check the prompt template against the required schema.`);
            }

            // Log warnings if any
            if (validation.warnings.length > 0) {
                promptErrorHandler.logError(
                    PromptError.VALIDATION_ERROR,
                    `Prompt validation warnings for ${filePath}`,
                    { warnings: validation.warnings }
                );
            }

            const stats = await fs.promises.stat(filePath);
            if (!promptData.last_modified) {
                promptData.last_modified = stats.mtime.toISOString().split('T')[0];
            }

            return promptData as JsonPrompt;
        } catch (error) {
            // Log the error but re-throw the original specific error
            promptErrorHandler.handleError(PromptError.TEMPLATE_PARSE_ERROR, {
                filePath,
                originalError: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }

    /**
     * Validate prompt file format
     */
    async validatePromptFile(filePath: string): Promise<ValidationResult> {
        try {
            if (!fs.existsSync(filePath)) {
                return {
                    isValid: false,
                    errors: [`File does not exist: ${filePath}`],
                    warnings: []
                };
            }

            const fileContent = await fs.promises.readFile(filePath, 'utf8');
            let promptData: any;

            try {
                promptData = JSON.parse(fileContent);
            } catch (parseError) {
                promptErrorHandler.handleError(PromptError.TEMPLATE_PARSE_ERROR, {
                    filePath,
                    parseError: parseError instanceof Error ? parseError.message : 'Unknown parse error'
                });
                return {
                    isValid: false,
                    errors: [`Invalid JSON: ${parseError}`],
                    warnings: []
                };
            }

            // Fix category before validation (like in loadPromptFromFile)
            if (!Object.values(PromptCategory).includes(promptData.category)) {
                promptData.category = PromptCategory.GENERAL;
            }

            // Use comprehensive validation
            return this.promptValidator.validatePrompt(promptData);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            promptErrorHandler.handleError(PromptError.VALIDATION_ERROR, { 
                filePath,
                error: errorMessage,
                operation: 'validate_prompt_file'
            });
            return {
                isValid: false,
                errors: [`Prompt validation failed for ${filePath}: ${errorMessage}. Please check the JSON structure and ensure all required fields are present.`],
                warnings: []
            };
        }
    }

    /**
     * Validate prompt data against schema
     */
    private async validatePromptData(promptData: any, filePath?: string): Promise<ValidationResult> {
        const result: ValidationResult = {
            isValid: true,
            errors: [],
            warnings: []
        };

        // Schema validation
        const validate = this.ajv.compile(this.schema);
        const isValid = validate(promptData);

        if (!isValid && validate.errors) {
            result.isValid = false;
            result.errors = validate.errors.map(error =>
                `${error.instancePath || 'root'}: ${error.message}`
            );
        }

        // Additional custom validations
        this.performCustomValidations(promptData, result, filePath);

        return result;
    }

    /**
     * Perform additional custom validations beyond schema
     */
    private performCustomValidations(promptData: any, result: ValidationResult, filePath?: string): void {
        if (promptData.template) {
            if (!promptData.template.task || promptData.template.task.trim() === '') {
                result.errors.push('Template task cannot be empty');
                result.isValid = false;
            }

            if (!promptData.template.instructions || promptData.template.instructions.trim() === '') {
                result.errors.push('Template instructions cannot be empty');
                result.isValid = false;
            }

            // Validate variables array
            if (promptData.template.variables && !Array.isArray(promptData.template.variables)) {
                result.errors.push('Template variables must be an array');
                result.isValid = false;
            }

            if (promptData.template.variables && promptData.template.instructions) {
                const variablePattern = /\$\{(\w+)\}/g;
                const referencedVars = new Set<string>();
                let match;

                while ((match = variablePattern.exec(promptData.template.instructions)) !== null) {
                    referencedVars.add(match[1]);
                }

                const declaredVars = new Set(promptData.template.variables);

                for (const referencedVar of referencedVars) {
                    if (!declaredVars.has(referencedVar)) {
                        result.warnings.push(`Variable '${referencedVar}' is referenced but not declared in variables array`);
                    }
                }

                for (const declaredVar of declaredVars) {
                    if (!referencedVars.has(declaredVar as string)) {
                        result.warnings.push(`Variable '${declaredVar}' is declared but not used in instructions`);
                    }
                }
            }
        }

        // Validate ID format
        if (promptData.id && !/^[a-z0-9-_]+$/.test(promptData.id)) {
            result.warnings.push('Prompt ID should only contain lowercase letters, numbers, hyphens, and underscores');
        }

        // Validate version format
        if (promptData.version && !/^\d+\.\d+\.\d+$/.test(promptData.version)) {
            result.warnings.push('Version should follow semantic versioning format (x.y.z)');
        }

        if (promptData.schema_version && promptData.schema_version !== '1.0.0') {
            result.warnings.push(`Schema version '${promptData.schema_version}' may not be fully compatible`);
        }

        // Validate category
        if (promptData.category && !Object.values(PromptCategory).includes(promptData.category)) {
            result.warnings.push(`Unknown category '${promptData.category}', will default to 'general'`);
        }
    }

    /**
     * Discover all JSON prompt files in a directory recursively
     */
    async discoverPromptFiles(directory: string, recursive: boolean = false): Promise<string[]> {
        const promptFiles: string[] = [];

        try {
            if (!fs.existsSync(directory)) {
                return promptFiles;
            }

            const entries = await fs.promises.readdir(directory, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(directory, entry.name);

                if (entry.isFile() && entry.name.endsWith('.json')) {
                    promptFiles.push(fullPath);
                } else if (entry.isDirectory() && recursive) {
                    const subFiles = await this.discoverPromptFiles(fullPath, recursive);
                    promptFiles.push(...subFiles);
                }
            }

            return promptFiles;
        } catch (error) {
            console.error(`Error discovering prompt files in ${directory}:`, error);
            return promptFiles;
        }
    }

    /**
     * Get validation statistics for a directory of prompts
     */
    async getValidationStats(directory: string): Promise<{
        total: number;
        valid: number;
        invalid: number;
        warnings: number;
    }> {
        const stats = { total: 0, valid: 0, invalid: 0, warnings: 0 };

        try {
            const files = await this.discoverPromptFiles(directory);
            stats.total = files.length;

            for (const file of files) {
                const validation = await this.validatePromptFile(file);
                if (validation.isValid) {
                    stats.valid++;
                } else {
                    stats.invalid++;
                }
                if (validation.warnings.length > 0) {
                    stats.warnings++;
                }
            }
        } catch (error) {
            console.error('Error getting validation stats:', error);
        }

        return stats;
    }

    /**
     * Scan multiple custom directories for prompts
     */
    async scanCustomDirectories(directories: string[]): Promise<Map<string, JsonPrompt[]>> {
        const result = new Map<string, JsonPrompt[]>();

        for (const directory of directories) {
            try {
                const prompts = await this.loadPromptsFromDirectory(directory);
                result.set(directory, prompts);
                
                promptErrorHandler.logError(
                    PromptError.CONFIGURATION_ERROR,
                    `Scanned custom directory: ${directory}, found ${prompts.length} JSON prompts`,
                    { 
                        directory, 
                        jsonPromptCount: prompts.length,
                        scanMode: 'json_only'
                    }
                );
            } catch (error) {
                promptErrorHandler.handleError(PromptError.CONFIGURATION_ERROR, {
                    directory,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
                result.set(directory, []);
            }
        }

        return result;
    }

    /**
     * Watch directory for changes and return file system watcher
     */
    watchDirectory(directory: string, callback: (eventType: string, filename: string) => void): any {
        try {
            if (!fs.existsSync(directory)) {
                promptErrorHandler.logError(
                    PromptError.CONFIGURATION_ERROR,
                    `Cannot watch non-existent directory: ${directory}`,
                    { directory }
                );
                return null;
            }

            const watcher = fs.watch(directory, { recursive: true }, (eventType, filename) => {
                if (filename && filename.endsWith('.json')) {
                    callback(eventType, filename);
                }
            });

            promptErrorHandler.logError(
                PromptError.CONFIGURATION_ERROR,
                `Started watching directory: ${directory}`,
                { directory }
            );

            return watcher;
        } catch (error) {
            promptErrorHandler.handleError(PromptError.CONFIGURATION_ERROR, {
                directory,
                error: error instanceof Error ? error.message : 'Unknown error',
                operation: 'watch_directory'
            });
            return null;
        }
    }

    /**
     * Get directory metadata and statistics
     */
    async getDirectoryMetadata(directory: string): Promise<{
        exists: boolean;
        readable: boolean;
        promptFiles: number;
        totalFiles: number;
        lastModified: Date | null;
        size: number;
    }> {
        const metadata = {
            exists: false,
            readable: false,
            promptFiles: 0,
            totalFiles: 0,
            lastModified: null as Date | null,
            size: 0
        };

        try {
            if (!fs.existsSync(directory)) {
                return metadata;
            }

            metadata.exists = true;

            try {
                await fs.promises.access(directory, fs.constants.R_OK);
                metadata.readable = true;
            } catch {
                return metadata;
            }

            const stats = await fs.promises.stat(directory);
            metadata.lastModified = stats.mtime;

            // Count files
            const files = await fs.promises.readdir(directory);
            metadata.totalFiles = files.length;
            metadata.promptFiles = files.filter(file => file.endsWith('.json')).length;

            // Calculate total size
            for (const file of files) {
                try {
                    const filePath = path.join(directory, file);
                    const fileStats = await fs.promises.stat(filePath);
                    if (fileStats.isFile()) {
                        metadata.size += fileStats.size;
                    }
                } catch {
                    // Skip files that can't be accessed
                }
            }

        } catch (error) {
            promptErrorHandler.handleError(PromptError.CONFIGURATION_ERROR, {
                directory,
                error: error instanceof Error ? error.message : 'Unknown error',
                operation: 'get_directory_metadata'
            });
        }

        return metadata;
    }
}