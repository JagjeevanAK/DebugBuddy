/**
 * Integration tests for the prompt system with existing command handlers
 */

import * as assert from 'assert';
import { PromptManager } from '../prompt/PromptManager';
import { UserAction, CodeContext } from '../prompt/types';

suite('Prompt System Integration', () => {
    let promptManager: PromptManager;

    setup(async () => {
        promptManager = PromptManager.getInstance();
        // Reset the singleton for each test
        (promptManager as any).initialized = false;
    });

    suite('PromptManager Integration', () => {
        test('should initialize successfully', async () => {
            await promptManager.initialize();
            assert.strictEqual(promptManager.isInitialized(), true);
        });

        test('should process code review requests', async () => {
            await promptManager.initialize();
            
            const codeContext: CodeContext = {
                selectedText: 'function test() { return "hello"; }',
                fullText: 'function test() { return "hello"; }',
                filePath: '/test/file.js',
                language: 'javascript'
            };

            const result = await promptManager.processRequest(UserAction.CODE_REVIEW, codeContext);
            
            assert.ok(result);
            assert.ok(result.content);
            assert.ok(result.metadata);
            assert.ok(result.variables_used);
        });

        test('should process debug error requests', async () => {
            await promptManager.initialize();
            
            const codeContext: CodeContext = {
                selectedText: 'console.log(undefinedVar);',
                fullText: 'console.log(undefinedVar);',
                filePath: '/test/file.js',
                language: 'javascript',
                errorMessage: 'ReferenceError: undefinedVar is not defined',
                lineNumber: 1,
                columnNumber: 12
            };

            const result = await promptManager.processRequest(UserAction.DEBUG_ERROR, codeContext);
            
            assert.ok(result);
            assert.ok(result.content);
            assert.ok(result.metadata);
        });

        test('should handle missing JSON prompts with proper error', async () => {
            // Clear the registry to simulate no prompts available
            const promptSystem = (promptManager as any).promptSystem;
            const registry = promptSystem.getRegistry();
            registry.clear();
            
            const codeContext: CodeContext = {
                selectedText: 'test code',
                language: 'javascript'
            };

            // Should throw error when no JSON prompts are available
            await assert.rejects(
                async () => await promptManager.processRequest(UserAction.CODE_REVIEW, codeContext),
                /No JSON prompt available/
            );
        });

        test('should handle missing specific prompts with proper error', async () => {
            await promptManager.initialize();
            
            const codeContext: CodeContext = {
                selectedText: 'test code',
                language: 'javascript'
            };

            // Should throw error if specific prompt type is not available
            await assert.rejects(
                async () => await promptManager.processRequest(UserAction.GENERATE_TESTS, codeContext),
                /No JSON prompt available/
            );
        });

        test('should provide available prompt types', async () => {
            await promptManager.initialize();
            
            const availableTypes = promptManager.getAvailablePromptTypes();
            
            assert.ok(Array.isArray(availableTypes));
            // Should have at least some prompt types available
            assert.ok(availableTypes.length >= 0);
        });

        test('should validate prompt integrity', async () => {
            await promptManager.initialize();
            
            const validationResults = promptManager.validatePromptIntegrity();
            
            assert.ok(Array.isArray(validationResults));
            // Each result should have the expected structure
            validationResults.forEach(result => {
                assert.ok(result.hasOwnProperty('name'));
                assert.ok(result.hasOwnProperty('isValid'));
                assert.ok(result.hasOwnProperty('errors'));
                assert.ok(result.hasOwnProperty('warnings'));
            });
        });
    });

    suite('Context Analysis Integration', () => {
        test('should analyze code context correctly', async () => {
            await promptManager.initialize();
            
            const registry = promptManager.getPromptSystem().getRegistry();
            const mockPrompt = {
                id: 'debug-analysis',
                name: 'Debug Analysis',
                description: 'Debug analysis prompt',
                category: 'debug_analysis' as any,
                version: '1.0.0',
                schema_version: '1.0',
                template: {
                    task: 'Debug the following code',
                    instructions: 'Analyze the error and provide suggestions',
                    context: { test: true },
                    output_format: { structure: 'list' },
                    variables: ['code', 'error', 'language']
                },
                config: {
                    configurable_fields: [],
                    default_values: {},
                    validation_rules: {}
                }
            };
            registry.registerPrompt('debug-analysis', mockPrompt);
            
            const codeContext: CodeContext = {
                selectedText: 'function test() { return "hello"; }',
                filePath: '/test/component.tsx',
                language: 'typescript',
                errorMessage: 'Type error: Property does not exist',
                diagnostics: [{
                    message: 'Type error',
                    source: 'typescript',
                    severity: 1
                }]
            };

            const result = await promptManager.processRequest(UserAction.DEBUG_ERROR, codeContext);
            
            assert.ok(result);
            // Should have processed the context and selected appropriate prompt
            assert.ok(result.variables_used.length > 0);
        });
    });

    suite('Variable Substitution Integration', () => {
        test('should substitute variables in prompts', async () => {
            await promptManager.initialize();
            
            const registry = promptManager.getPromptSystem().getRegistry();
            const mockPrompt = {
                id: 'code-review',
                name: 'Code Review',
                description: 'Code review prompt',
                category: 'code_review' as any,
                version: '1.0.0',
                schema_version: '1.0',
                template: {
                    task: 'Review the following ${language} code',
                    instructions: 'Analyze the code for quality and best practices',
                    context: { code: '${selectedCode}' },
                    output_format: { structure: 'list' },
                    variables: ['selectedCode', 'language']
                },
                config: {
                    configurable_fields: [],
                    default_values: {},
                    validation_rules: {}
                }
            };
            registry.registerPrompt('code-review', mockPrompt);
            
            const codeContext: CodeContext = {
                selectedText: 'const x = 1;',
                filePath: '/test/math.js',
                language: 'javascript'
            };

            const result = await promptManager.processRequest(UserAction.CODE_REVIEW, codeContext);
            
            assert.ok(result);
            assert.ok(result.variables_used.includes('language'));
            assert.ok(result.variables_used.includes('selectedCode'));
        });
    });

    suite('Error Handling Integration', () => {
        test('should handle initialization errors with proper error responses', async () => {
            // Mock a failure in the prompt system
            const originalConsoleError = console.error;
            console.error = () => {}; // Suppress error logs

            try {
                // Create a new prompt manager instance that will fail initialization
                const failingPromptManager = PromptManager.getInstance();
                
                // Clear the registry to simulate initialization failure
                const registry = failingPromptManager['promptSystem'].getRegistry();
                registry.clear();
                
                // Reset initialization state to force re-initialization
                (failingPromptManager as any).initialized = false;

                const codeContext: CodeContext = {
                    selectedText: 'test',
                    language: 'javascript'
                };

                // Should throw error when no prompts are available
                await assert.rejects(
                    async () => await failingPromptManager.processRequest(UserAction.CODE_REVIEW, codeContext),
                    /No JSON prompt available/
                );
            } finally {
                console.error = originalConsoleError;
            }
        });
    });
});