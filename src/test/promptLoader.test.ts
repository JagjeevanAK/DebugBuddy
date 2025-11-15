import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PromptLoader } from '../prompt/PromptLoader';
import { JsonPrompt, PromptCategory } from '../prompt/types';

suite('PromptLoader Test Suite', () => {
    let promptLoader: PromptLoader;
    let tempDir: string;

    suiteSetup(() => {
        promptLoader = new PromptLoader();
        // Create a temporary directory for test files
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-loader-test-'));
    });

    suiteTeardown(() => {
        // Clean up temporary directory
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    suite('loadPromptFromFile', () => {
        test('should load valid JSON prompt file', async () => {
            const validPrompt: JsonPrompt = {
                id: 'test-prompt',
                name: 'Test Prompt',
                description: 'A test prompt',
                category: PromptCategory.CODE_REVIEW,
                version: '1.0.0',
                schema_version: '1.0.0',
                template: {
                    task: 'Test task',
                    context: {},
                    instructions: 'Test instructions with ${variable}',
                    output_format: {
                        structure: 'list'
                    },
                    variables: ['variable']
                },
                config: {
                    configurable_fields: [],
                    default_values: {},
                    validation_rules: {}
                }
            };

            const testFile = path.join(tempDir, 'valid-prompt.json');
            fs.writeFileSync(testFile, JSON.stringify(validPrompt, null, 2));

            const loadedPrompt = await promptLoader.loadPromptFromFile(testFile);
            
            assert.strictEqual(loadedPrompt.id, 'test-prompt');
            assert.strictEqual(loadedPrompt.name, 'Test Prompt');
            assert.strictEqual(loadedPrompt.category, PromptCategory.CODE_REVIEW);
            assert.strictEqual(loadedPrompt.template.task, 'Test task');
            assert.deepStrictEqual(loadedPrompt.template.variables, ['variable']);
        });

        test('should throw error for non-existent file', async () => {
            const nonExistentFile = path.join(tempDir, 'non-existent.json');
            
            await assert.rejects(
                async () => await promptLoader.loadPromptFromFile(nonExistentFile),
                /Prompt file does not exist/
            );
        });

        test('should throw error for invalid JSON', async () => {
            const invalidJsonFile = path.join(tempDir, 'invalid.json');
            fs.writeFileSync(invalidJsonFile, '{ invalid json }');

            await assert.rejects(
                async () => await promptLoader.loadPromptFromFile(invalidJsonFile),
                /Invalid JSON in prompt file/
            );
        });

        test('should throw error for invalid prompt structure', async () => {
            const invalidPrompt = {
                id: 'test',
                // Missing required fields
            };

            const invalidFile = path.join(tempDir, 'invalid-structure.json');
            fs.writeFileSync(invalidFile, JSON.stringify(invalidPrompt));

            await assert.rejects(
                async () => await promptLoader.loadPromptFromFile(invalidFile),
                /Invalid prompt structure/
            );
        });

        test('should handle unknown category gracefully', async () => {
            const promptWithUnknownCategory = {
                id: 'test-unknown-category',
                name: 'Test Prompt',
                description: 'A test prompt',
                category: 'unknown_category',
                version: '1.0.0',
                schema_version: '1.0.0',
                template: {
                    task: 'Test task',
                    context: {},
                    instructions: 'Test instructions',
                    output_format: {
                        structure: 'list'
                    },
                    variables: []
                },
                config: {
                    configurable_fields: [],
                    default_values: {},
                    validation_rules: {}
                }
            };

            const testFile = path.join(tempDir, 'unknown-category.json');
            fs.writeFileSync(testFile, JSON.stringify(promptWithUnknownCategory));

            const loadedPrompt = await promptLoader.loadPromptFromFile(testFile);
            
            // Should default to GENERAL category
            assert.strictEqual(loadedPrompt.category, PromptCategory.GENERAL);
        });
    });

    suite('loadPromptsFromDirectory', () => {
        test('should load multiple valid prompts from directory', async () => {
            const testDir = path.join(tempDir, 'multiple-prompts');
            fs.mkdirSync(testDir, { recursive: true });

            // Create multiple valid prompt files
            const prompt1 = {
                id: 'prompt-1',
                name: 'Prompt 1',
                description: 'First prompt',
                category: PromptCategory.CODE_REVIEW,
                version: '1.0.0',
                schema_version: '1.0.0',
                template: {
                    task: 'Task 1',
                    context: {},
                    instructions: 'Instructions 1',
                    output_format: { structure: 'list' },
                    variables: []
                },
                config: {
                    configurable_fields: [],
                    default_values: {},
                    validation_rules: {}
                }
            };

            const prompt2 = {
                id: 'prompt-2',
                name: 'Prompt 2',
                description: 'Second prompt',
                category: PromptCategory.DEBUG_ANALYSIS,
                version: '1.0.0',
                schema_version: '1.0.0',
                template: {
                    task: 'Task 2',
                    context: {},
                    instructions: 'Instructions 2',
                    output_format: { structure: 'list' },
                    variables: []
                },
                config: {
                    configurable_fields: [],
                    default_values: {},
                    validation_rules: {}
                }
            };

            fs.writeFileSync(path.join(testDir, 'prompt1.json'), JSON.stringify(prompt1));
            fs.writeFileSync(path.join(testDir, 'prompt2.json'), JSON.stringify(prompt2));
            fs.writeFileSync(path.join(testDir, 'readme.txt'), 'This should be ignored');

            const loadedPrompts = await promptLoader.loadPromptsFromDirectory(testDir);

            assert.strictEqual(loadedPrompts.length, 2);
            assert.strictEqual(loadedPrompts[0].id, 'prompt-1');
            assert.strictEqual(loadedPrompts[1].id, 'prompt-2');
        });

        test('should return empty array for non-existent directory', async () => {
            const nonExistentDir = path.join(tempDir, 'non-existent');
            const prompts = await promptLoader.loadPromptsFromDirectory(nonExistentDir);
            
            assert.strictEqual(prompts.length, 0);
        });

        test('should continue loading other prompts when one fails', async () => {
            const testDir = path.join(tempDir, 'mixed-prompts');
            fs.mkdirSync(testDir, { recursive: true });

            // Create one valid and one invalid prompt
            const validPrompt = {
                id: 'valid-prompt',
                name: 'Valid Prompt',
                description: 'A valid prompt',
                category: PromptCategory.CODE_REVIEW,
                version: '1.0.0',
                schema_version: '1.0.0',
                template: {
                    task: 'Valid task',
                    context: {},
                    instructions: 'Valid instructions',
                    output_format: { structure: 'list' },
                    variables: []
                },
                config: {
                    configurable_fields: [],
                    default_values: {},
                    validation_rules: {}
                }
            };

            fs.writeFileSync(path.join(testDir, 'valid.json'), JSON.stringify(validPrompt));
            fs.writeFileSync(path.join(testDir, 'invalid.json'), '{ invalid json }');

            const loadedPrompts = await promptLoader.loadPromptsFromDirectory(testDir);

            // Should load only the valid prompt
            assert.strictEqual(loadedPrompts.length, 1);
            assert.strictEqual(loadedPrompts[0].id, 'valid-prompt');
        });
    });

    suite('validatePromptFile', () => {
        test('should validate correct prompt file', async () => {
            const validPrompt = {
                id: 'valid-prompt',
                name: 'Valid Prompt',
                description: 'A valid prompt',
                category: PromptCategory.CODE_REVIEW,
                version: '1.0.0',
                schema_version: '1.0.0',
                template: {
                    task: 'Valid task',
                    context: {},
                    instructions: 'Valid instructions with ${variable}',
                    output_format: { structure: 'list' },
                    variables: ['variable']
                },
                config: {
                    configurable_fields: [],
                    default_values: {},
                    validation_rules: {}
                }
            };

            const testFile = path.join(tempDir, 'validation-test.json');
            fs.writeFileSync(testFile, JSON.stringify(validPrompt));

            const result = await promptLoader.validatePromptFile(testFile);

            assert.strictEqual(result.isValid, true);
            assert.strictEqual(result.errors.length, 0);
        });

        test('should detect missing required fields', async () => {
            const invalidPrompt = {
                id: 'incomplete-prompt',
                name: 'Incomplete Prompt'
                // Missing required fields
            };

            const testFile = path.join(tempDir, 'incomplete.json');
            fs.writeFileSync(testFile, JSON.stringify(invalidPrompt));

            const result = await promptLoader.validatePromptFile(testFile);

            assert.strictEqual(result.isValid, false);
            assert.ok(result.errors.length > 0);
        });

        test('should detect unused variables', async () => {
            const promptWithUnusedVar = {
                id: 'unused-var-prompt',
                name: 'Unused Variable Prompt',
                description: 'A prompt with unused variables',
                category: PromptCategory.CODE_REVIEW,
                version: '1.0.0',
                schema_version: '1.0.0',
                template: {
                    task: 'Task',
                    context: {},
                    instructions: 'Instructions without variables',
                    output_format: { structure: 'list' },
                    variables: ['unused_variable']
                },
                config: {
                    configurable_fields: [],
                    default_values: {},
                    validation_rules: {}
                }
            };

            const testFile = path.join(tempDir, 'unused-var.json');
            fs.writeFileSync(testFile, JSON.stringify(promptWithUnusedVar));

            const result = await promptLoader.validatePromptFile(testFile);

            assert.ok(result.warnings.some(w => w.includes('unused_variable')));
        });

        test('should detect undeclared variables', async () => {
            const promptWithUndeclaredVar = {
                id: 'undeclared-var-prompt',
                name: 'Undeclared Variable Prompt',
                description: 'A prompt with undeclared variables',
                category: PromptCategory.CODE_REVIEW,
                version: '1.0.0',
                schema_version: '1.0.0',
                template: {
                    task: 'Task',
                    context: {},
                    instructions: 'Instructions with ${undeclared_variable}',
                    output_format: { structure: 'list' },
                    variables: []
                },
                config: {
                    configurable_fields: [],
                    default_values: {},
                    validation_rules: {}
                }
            };

            const testFile = path.join(tempDir, 'undeclared-var.json');
            fs.writeFileSync(testFile, JSON.stringify(promptWithUndeclaredVar));

            const result = await promptLoader.validatePromptFile(testFile);

            assert.ok(result.warnings.some(w => w.includes('undeclared_variable')));
        });

        test('should return error for non-existent file', async () => {
            const nonExistentFile = path.join(tempDir, 'does-not-exist.json');
            
            const result = await promptLoader.validatePromptFile(nonExistentFile);

            assert.strictEqual(result.isValid, false);
            assert.ok(result.errors.some(e => e.includes('File does not exist')));
        });
    });

    suite('discoverPromptFiles', () => {
        test('should discover JSON files in directory', async () => {
            const testDir = path.join(tempDir, 'discovery-test');
            fs.mkdirSync(testDir, { recursive: true });

            // Create test files
            fs.writeFileSync(path.join(testDir, 'prompt1.json'), '{}');
            fs.writeFileSync(path.join(testDir, 'prompt2.json'), '{}');
            fs.writeFileSync(path.join(testDir, 'readme.txt'), 'not json');

            const files = await promptLoader.discoverPromptFiles(testDir);

            assert.strictEqual(files.length, 2);
            assert.ok(files.some(f => f.endsWith('prompt1.json')));
            assert.ok(files.some(f => f.endsWith('prompt2.json')));
        });

        test('should discover files recursively when enabled', async () => {
            const testDir = path.join(tempDir, 'recursive-test');
            const subDir = path.join(testDir, 'subdir');
            fs.mkdirSync(subDir, { recursive: true });

            fs.writeFileSync(path.join(testDir, 'root.json'), '{}');
            fs.writeFileSync(path.join(subDir, 'sub.json'), '{}');

            const files = await promptLoader.discoverPromptFiles(testDir, true);

            assert.strictEqual(files.length, 2);
            assert.ok(files.some(f => f.endsWith('root.json')));
            assert.ok(files.some(f => f.endsWith('sub.json')));
        });

        test('should not discover files recursively when disabled', async () => {
            const testDir = path.join(tempDir, 'non-recursive-test');
            const subDir = path.join(testDir, 'subdir');
            fs.mkdirSync(subDir, { recursive: true });

            fs.writeFileSync(path.join(testDir, 'root.json'), '{}');
            fs.writeFileSync(path.join(subDir, 'sub.json'), '{}');

            const files = await promptLoader.discoverPromptFiles(testDir, false);

            assert.strictEqual(files.length, 1);
            assert.ok(files.some(f => f.endsWith('root.json')));
        });
    });

    suite('getValidationStats', () => {
        test('should return correct validation statistics', async () => {
            const testDir = path.join(tempDir, 'stats-test');
            fs.mkdirSync(testDir, { recursive: true });

            // Create valid prompt
            const validPrompt = {
                id: 'valid',
                name: 'Valid',
                description: 'Valid prompt',
                category: PromptCategory.CODE_REVIEW,
                version: '1.0.0',
                schema_version: '1.0.0',
                template: {
                    task: 'Task',
                    context: {},
                    instructions: 'Instructions',
                    output_format: { structure: 'list' },
                    variables: []
                },
                config: {
                    configurable_fields: [],
                    default_values: {},
                    validation_rules: {}
                }
            };

            // Create prompt with warnings
            const warningPrompt = {
                id: 'warning',
                name: 'Warning',
                description: 'Prompt with warnings',
                category: PromptCategory.CODE_REVIEW,
                version: 'invalid-version', // This will generate a warning
                schema_version: '1.0.0',
                template: {
                    task: 'Task',
                    context: {},
                    instructions: 'Instructions',
                    output_format: { structure: 'list' },
                    variables: []
                },
                config: {
                    configurable_fields: [],
                    default_values: {},
                    validation_rules: {}
                }
            };

            fs.writeFileSync(path.join(testDir, 'valid.json'), JSON.stringify(validPrompt));
            fs.writeFileSync(path.join(testDir, 'warning.json'), JSON.stringify(warningPrompt));
            fs.writeFileSync(path.join(testDir, 'invalid.json'), '{ invalid }');

            const stats = await promptLoader.getValidationStats(testDir);

            assert.strictEqual(stats.total, 3);
            assert.strictEqual(stats.valid, 2); // valid and warning prompts are structurally valid
            assert.strictEqual(stats.invalid, 1); // invalid.json
            assert.strictEqual(stats.warnings, 2); // both valid.json and warning.json have warnings
        });
    });
});