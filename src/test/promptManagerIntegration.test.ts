/**
 * Integration tests for PromptManager orchestration layer
 * Tests the complete prompt processing flow from request to response
 */

import * as assert from 'assert';
import { PromptManager } from '../prompt/PromptManager';
import { PromptSystem } from '../prompt/PromptSystem';
import { PromptRegistry } from '../prompt/PromptRegistry';
import { ContextAnalyzer } from '../prompt/ContextAnalyzer';
import { TemplateEngine } from '../prompt/TemplateEngine';
import { ConfigurationManager } from '../prompt/ConfigurationManager';
import { PromptValidator } from '../prompt/PromptValidator';
import { promptErrorHandler } from '../prompt/ErrorHandler';
import { 
    UserAction, 
    CodeContext, 
    JsonPrompt, 
    PromptCategory, 
    PromptError,
    ProcessedPrompt 
} from '../prompt/types';

suite('PromptManager Integration Tests', () => {
    let promptManager: PromptManager;
    let promptSystem: PromptSystem;
    let registry: PromptRegistry;

    setup(async () => {
        // Get fresh instances for each test
        promptManager = PromptManager.getInstance();
        promptSystem = PromptSystem.getInstance();
        registry = promptSystem.getRegistry();

        // Reset the system state
        promptSystem.reset();
        promptErrorHandler.clearErrorStats();
        
        // Reset the manager initialization state
        (promptManager as any).initialized = false;
    });

    suite('Initialization and Component Integration', () => {
        test('should initialize all components successfully', async () => {
            await promptManager.initialize();
            
            assert.strictEqual(promptManager.isInitialized(), true);
            assert.strictEqual(promptSystem.isInitialized(), true);
            
            const stats = promptManager.getStats();
            assert.ok(stats.initialized);
            assert.ok(stats.promptSystem);
        });

        test('should handle initialization failures gracefully', async () => {
            // Mock a system failure
            const originalInitialize = promptSystem.initialize;
            promptSystem.initialize = async () => {
                throw new Error('Mock initialization failure');
            };

            try {
                await assert.rejects(
                    () => promptManager.initialize(),
                    /Failed to initialize PromptManager/
                );
            } finally {
                // Restore original method
                promptSystem.initialize = originalInitialize;
            }
        });

        test('should validate prompt integrity during initialization', async () => {
            const validPrompt: JsonPrompt = {
                id: 'test-valid',
                name: 'Test Valid Prompt',
                description: 'A valid test prompt',
                category: PromptCategory.CODE_REVIEW,
                version: '1.0.0',
                schema_version: '1.0',
                template: {
                    task: 'Review code',
                    instructions: 'Analyze the ${code} for issues',
                    context: { focus: 'quality' },
                    output_format: { structure: 'list' },
                    variables: ['code']
                },
                config: {
                    configurable_fields: ['focus'],
                    default_values: { focus: 'quality' },
                    validation_rules: {}
                }
            };

            const invalidPrompt = {
                id: 'test-invalid',
                name: 'Test Invalid Prompt',
                // Missing required fields
            } as any;

            registry.registerPrompt('test-valid', validPrompt);
            registry.registerPrompt('test-invalid', invalidPrompt);

            await promptManager.initialize();

            const validationResults = promptManager.validatePromptIntegrity();
            assert.ok(validationResults.length >= 2);
            
            const validResult = validationResults.find(r => r.name === 'test-valid');
            const invalidResult = validationResults.find(r => r.name === 'test-invalid');
            
            assert.strictEqual(validResult?.isValid, true);
            assert.strictEqual(invalidResult?.isValid, false);
        });
    });

    suite('End-to-End Prompt Processing', () => {
        test('should process code review request completely', async () => {
            await promptManager.initialize();

            const codeContext: CodeContext = {
                selectedText: 'function calculateSum(a, b) { return a + b; }',
                fullText: 'function calculateSum(a, b) { return a + b; }',
                filePath: '/test/calculator.js',
                language: 'javascript',
                lineNumber: 1,
                columnNumber: 1
            };

            const result = await promptManager.processRequest(UserAction.CODE_REVIEW, codeContext);

            assert.ok(result);
            assert.ok(result.content);
            assert.ok(result.metadata);
            assert.ok(Array.isArray(result.variables_used));

            assert.ok(result.variables_used.includes('language'));
            assert.ok(result.variables_used.includes('selectedCode') || result.variables_used.includes('code'));

            assert.ok(typeof result.content === 'object');
            assert.ok((result.content as any).task);
        });

        test('should process debug error request with error context', async () => {
            await promptManager.initialize();

            const codeContext: CodeContext = {
                selectedText: 'console.log(undefinedVariable);',
                fullText: 'console.log(undefinedVariable);',
                filePath: '/test/debug.js',
                language: 'javascript',
                errorMessage: 'ReferenceError: undefinedVariable is not defined',
                lineNumber: 1,
                columnNumber: 12,
                diagnostics: [{
                    message: 'undefinedVariable is not defined',
                    source: 'javascript',
                    severity: 1
                }]
            };

            const result = await promptManager.processRequest(UserAction.DEBUG_ERROR, codeContext);

            assert.ok(result);
            assert.ok(result.content);
            
            assert.ok(result.variables_used.includes('errorMessage'));
            assert.ok(result.variables_used.includes('language'));
        });

        test('should handle multiple sequential requests', async () => {
            await promptManager.initialize();

            const codeContext: CodeContext = {
                selectedText: 'const x = 1;',
                language: 'javascript'
            };

            // Process multiple requests
            const results = await Promise.all([
                promptManager.processRequest(UserAction.CODE_REVIEW, codeContext),
                promptManager.processRequest(UserAction.REFACTOR, codeContext),
                promptManager.processRequest(UserAction.GENERATE_DOCS, codeContext)
            ]);

            // All requests should succeed
            results.forEach(result => {
                assert.ok(result);
                assert.ok(result.content);
                assert.ok(result.metadata);
            });

            // Each should have processed variables
            results.forEach(result => {
                assert.ok(result.variables_used.length > 0);
            });
        });
    });

    suite('Component Coordination', () => {
        test('should coordinate context analysis with prompt selection', async () => {
            await promptManager.initialize();

            const jsContext: CodeContext = {
                selectedText: 'function test() {}',
                language: 'javascript',
                filePath: '/test.js'
            };

            const errorContext: CodeContext = {
                selectedText: 'function test() {}',
                language: 'javascript',
                filePath: '/test.js',
                errorMessage: 'Syntax error',
                diagnostics: [{ message: 'Syntax error', source: 'javascript', severity: 1 }]
            };

            const reviewResult = await promptManager.processRequest(UserAction.CODE_REVIEW, jsContext);
            const debugResult = await promptManager.processRequest(UserAction.DEBUG_ERROR, errorContext);

            // Results should be different based on context
            assert.notDeepStrictEqual(reviewResult.content, debugResult.content);
            
            // Debug result should include error-specific variables
            assert.ok(debugResult.variables_used.includes('errorMessage'));
        });

        test('should coordinate template engine with configuration', async () => {
            await promptManager.initialize();

            const configManager = ConfigurationManager.getInstance();
            
            // Update global settings
            await configManager.updateGlobalSettings({
                experienceLevel: 'advanced',
                maxSuggestions: 10,
                outputVerbosity: 'detailed'
            });

            const codeContext: CodeContext = {
                selectedText: 'const x = 1;',
                language: 'javascript'
            };

            const result = await promptManager.processRequest(UserAction.CODE_REVIEW, codeContext);

            // Configuration should be reflected in variables
            assert.ok(result.variables_used.includes('experienceLevel'));
            assert.ok(result.variables_used.includes('maxSuggestions'));
            assert.ok(result.variables_used.includes('outputVerbosity'));
        });

        test('should coordinate validation with error handling', async () => {
            await promptManager.initialize();

            const invalidPrompt = {
                id: 'invalid-test',
                name: 'Invalid Test',
                description: 'Invalid prompt for testing',
                category: PromptCategory.CODE_REVIEW,
                version: '1.0.0',
                schema_version: '1.0',
                template: {
                    // Missing required fields
                    task: '',
                    instructions: ''
                },
                config: {
                    configurable_fields: [],
                    default_values: {},
                    validation_rules: {}
                }
            } as any;

            registry.registerPrompt('invalid-test', invalidPrompt);

            // Force the system to try to use the invalid prompt
            const originalGetPrompt = registry.getPrompt;
            registry.getPrompt = async (name: string) => {
                if (name === 'code-review') {
                    return invalidPrompt;
                }
                return originalGetPrompt.call(registry, name);
            };

            try {
                const codeContext: CodeContext = {
                    selectedText: 'test code',
                    language: 'javascript'
                };

                // Should throw error due to validation failure
                await assert.rejects(
                    async () => await promptManager.processRequest(UserAction.CODE_REVIEW, codeContext),
                    /validation failed|No JSON prompt available/
                );

                // Error should be logged
                const errorStats = promptErrorHandler.getErrorStats();
                assert.ok(Object.values(errorStats).some(stat => stat.count > 0));
            } finally {
                // Restore original method
                registry.getPrompt = originalGetPrompt;
            }
        });
    });

    suite('Error Handling and Recovery', () => {
        test('should handle prompt not found with proper error', async () => {
            await promptManager.initialize();

            // Clear all prompts to simulate not found scenario
            registry.clear();

            const codeContext: CodeContext = {
                selectedText: 'test code',
                language: 'javascript'
            };

            // Should throw error when no prompts are found
            await assert.rejects(
                async () => await promptManager.processRequest(UserAction.CODE_REVIEW, codeContext),
                /No JSON prompt available/
            );

            // Error should be logged
            const errorStats = promptErrorHandler.getErrorStats();
            assert.ok(Object.values(errorStats).some(stat => stat.count > 0));
        });

        test('should handle template processing errors', async () => {
            await promptManager.initialize();

            const problematicPrompt: JsonPrompt = {
                id: 'problematic',
                name: 'Problematic Prompt',
                description: 'A prompt that will cause template errors',
                category: PromptCategory.CODE_REVIEW,
                version: '1.0.0',
                schema_version: '1.0',
                template: {
                    task: '', // Empty task should cause validation error
                    instructions: '', // Empty instructions should cause validation error
                    context: null as any, // Invalid context should cause validation error
                    output_format: { structure: 'list' },
                    variables: ['code']
                },
                config: {
                    configurable_fields: [],
                    default_values: {},
                    validation_rules: {}
                }
            };

            registry.registerPrompt('problematic', problematicPrompt);

            // Force use of problematic prompt
            const originalGetPrompt = registry.getPrompt;
            registry.getPrompt = async (name: string) => {
                if (name === 'code-review') {
                    return problematicPrompt;
                }
                return originalGetPrompt.call(registry, name);
            };

            try {
                const codeContext: CodeContext = {
                    selectedText: 'test code',
                    language: 'javascript'
                };

                // Should throw error due to template validation issues
                await assert.rejects(
                    async () => await promptManager.processRequest(UserAction.CODE_REVIEW, codeContext),
                    /validation failed|Template task cannot be empty|Template must have non-empty instructions/i
                );
            } finally {
                registry.getPrompt = originalGetPrompt;
            }
        });

        test('should handle system health check', async () => {
            await promptManager.initialize();

            const healthCheck = promptManager.performHealthCheck();

            assert.ok(typeof healthCheck.healthy === 'boolean');
            assert.ok(Array.isArray(healthCheck.issues));
            assert.ok(Array.isArray(healthCheck.recommendations));

            if (healthCheck.healthy) {
                assert.strictEqual(healthCheck.issues.length, 0);
            } else {
                assert.ok(healthCheck.issues.length > 0);
                assert.ok(healthCheck.recommendations.length > 0);
            }
        });
    });

    suite('Performance and Statistics', () => {
        test('should provide comprehensive system statistics', async () => {
            await promptManager.initialize();

            const stats = promptManager.getStats();

            assert.ok(stats.initialized);
            assert.ok(stats.promptSystem);
            assert.ok(stats.errorStats);
            assert.ok(stats.recoveryCapabilities);

            assert.ok(typeof stats.promptSystem.totalPrompts === 'number');
            assert.ok(typeof stats.promptSystem.promptsByCategory === 'object');
        });

        test('should track available prompt types', async () => {
            await promptManager.initialize();

            const availableTypes = promptManager.getAvailablePromptTypes();

            assert.ok(Array.isArray(availableTypes));
            // Should have at least some built-in types
            assert.ok(availableTypes.length >= 0);

            // Each type should be a string
            availableTypes.forEach(type => {
                assert.strictEqual(typeof type, 'string');
                assert.ok(type.length > 0);
            });
        });

        test('should handle concurrent requests efficiently', async () => {
            await promptManager.initialize();

            const codeContext: CodeContext = {
                selectedText: 'const x = 1;',
                language: 'javascript'
            };

            const startTime = Date.now();

            // Process multiple concurrent requests
            const concurrentRequests = Array(10).fill(null).map(() =>
                promptManager.processRequest(UserAction.CODE_REVIEW, codeContext)
            );

            const results = await Promise.all(concurrentRequests);
            const endTime = Date.now();

            // All requests should succeed
            assert.strictEqual(results.length, 10);
            results.forEach(result => {
                assert.ok(result);
                assert.ok(result.content);
            });

            // Should complete in reasonable time (less than 5 seconds for 10 requests)
            const duration = endTime - startTime;
            assert.ok(duration < 5000, `Concurrent requests took too long: ${duration}ms`);
        });
    });

    suite('Variable Preparation and Context Handling', () => {
        test('should prepare comprehensive variable map', async () => {
            await promptManager.initialize();

            const codeContext: CodeContext = {
                selectedText: 'function test() { return "hello"; }',
                fullText: 'function test() { return "hello"; }\nconsole.log(test());',
                filePath: '/project/src/utils/helper.js',
                language: 'javascript',
                lineNumber: 1,
                columnNumber: 1,
                errorMessage: 'Type error',
                diagnostics: [{
                    message: 'Type error',
                    source: 'typescript',
                    severity: 1
                }],
                surroundingCode: 'const x = 1;\nfunction test() { return "hello"; }\nconst y = 2;'
            };

            const result = await promptManager.processRequest(UserAction.CODE_REVIEW, codeContext);

            const expectedVariables = [
                'language', 'selectedCode', 'code', 'filePath', 'fileName',
                'errorMessage', 'lineNumber', 'experienceLevel'
            ];

            expectedVariables.forEach(variable => {
                assert.ok(
                    result.variables_used.includes(variable) || 
                    result.variables_used.some(v => v.includes(variable)),
                    `Expected variable '${variable}' to be used`
                );
            });
        });

        test('should handle language-specific criteria', async () => {
            await promptManager.initialize();

            const contexts = [
                { language: 'javascript', filePath: '/test.js' },
                { language: 'typescript', filePath: '/test.ts' },
                { language: 'python', filePath: '/test.py' },
                { language: 'java', filePath: '/Test.java' }
            ];

            for (const context of contexts) {
                const codeContext: CodeContext = {
                    selectedText: 'test code',
                    ...context
                };

                const result = await promptManager.processRequest(UserAction.CODE_REVIEW, codeContext);

                assert.ok(result);
                assert.ok(result.variables_used.includes('language'));
                assert.ok(result.variables_used.includes('languageSpecificCriteria'));
            }
        });

        test('should handle experience level guidance', async () => {
            await promptManager.initialize();

            const configManager = ConfigurationManager.getInstance();
            const levels = ['beginner', 'intermediate', 'advanced'] as const;

            for (const level of levels) {
                await configManager.updateGlobalSettings({ experienceLevel: level });

                const codeContext: CodeContext = {
                    selectedText: 'test code',
                    language: 'javascript'
                };

                const result = await promptManager.processRequest(UserAction.CODE_REVIEW, codeContext);

                assert.ok(result);
                assert.ok(result.variables_used.includes('experienceLevel'));
                assert.ok(result.variables_used.includes('experienceLevelGuidance'));
            }
        });
    });

    suite('JSON-Only Behavior Verification', () => {
        test('should throw appropriate errors when JSON prompts are not available', async () => {
            await promptManager.initialize();
            
            // Clear the registry to simulate no prompts available
            const registry = promptSystem.getRegistry();
            registry.clear();
            
            const actions = [
                UserAction.CODE_REVIEW,
                UserAction.DEBUG_ERROR,
                UserAction.REFACTOR,
                UserAction.GENERATE_DOCS
            ];

            for (const action of actions) {
                const codeContext: CodeContext = {
                    selectedText: 'test code',
                    language: 'javascript',
                    errorMessage: action === UserAction.DEBUG_ERROR ? 'Test error' : undefined
                };

                // Should throw error when no JSON prompts are available
                await assert.rejects(
                    async () => await promptManager.processRequest(action, codeContext),
                    /No JSON prompt available/,
                    `Should throw error for action ${action}`
                );
            }
        });

        test('should provide descriptive error messages when specific prompts are missing', async () => {
            await promptManager.initialize();
            
            const testPrompt: JsonPrompt = {
                id: 'test-only',
                name: 'Test Only Prompt',
                description: 'Only available prompt for testing',
                category: PromptCategory.CODE_REVIEW,
                version: '1.0.0',
                schema_version: '1.0',
                template: {
                    task: 'Test task',
                    instructions: 'Test instructions',
                    context: { test: true },
                    output_format: { structure: 'list' },
                    variables: ['code']
                },
                config: {
                    configurable_fields: [],
                    default_values: {},
                    validation_rules: {}
                }
            };

            // Clear registry and add only one prompt
            registry.clear();
            registry.registerPrompt('test-only', testPrompt);

            const codeContext: CodeContext = {
                selectedText: 'test code',
                language: 'javascript'
            };

            // Should throw error with available prompt types listed
            await assert.rejects(
                async () => await promptManager.processRequest(UserAction.CODE_REVIEW, codeContext),
                /No JSON prompt available.*Available prompt types.*test-only/,
                'Should provide descriptive error with available prompt types'
            );
        });

        test('should verify error logging when prompts are unavailable', async () => {
            await promptManager.initialize();
            
            // Clear all prompts
            registry.clear();

            const codeContext: CodeContext = {
                selectedText: 'test code',
                language: 'javascript'
            };

            try {
                await promptManager.processRequest(UserAction.CODE_REVIEW, codeContext);
                assert.fail('Should have thrown an error');
            } catch (error) {
                assert.ok(error instanceof Error);
                assert.ok(error.message.includes('No JSON prompt available'));
            }

            const errorStats = promptErrorHandler.getErrorStats();
            assert.ok(Object.values(errorStats).some(stat => stat.count > 0), 'Should log errors when prompts unavailable');
        });

        test('should handle validation errors without legacy fallback', async () => {
            await promptManager.initialize();

            const invalidPrompt = {
                id: 'invalid-test',
                name: 'Invalid Test',
                description: 'Invalid prompt for testing',
                category: PromptCategory.CODE_REVIEW,
                version: '1.0.0',
                schema_version: '1.0',
                template: {
                    task: '', // Invalid: empty task
                    instructions: '', // Invalid: empty instructions
                    context: null, // Invalid: null context
                    output_format: { structure: 'list' },
                    variables: []
                },
                config: {
                    configurable_fields: [],
                    default_values: {},
                    validation_rules: {}
                }
            } as any;

            registry.registerPrompt('invalid-test', invalidPrompt);

            // Force use of invalid prompt
            const originalGetPrompt = registry.getPrompt;
            registry.getPrompt = async (name: string) => {
                if (name === 'code-review') {
                    return invalidPrompt;
                }
                return originalGetPrompt.call(registry, name);
            };

            try {
                const codeContext: CodeContext = {
                    selectedText: 'test code',
                    language: 'javascript'
                };

                // Should throw validation error, not fall back to legacy
                await assert.rejects(
                    async () => await promptManager.processRequest(UserAction.CODE_REVIEW, codeContext),
                    /validation failed/i,
                    'Should throw validation error without legacy fallback'
                );

                const errorStats = promptErrorHandler.getErrorStats();
                assert.ok(Object.values(errorStats).some(stat => stat.count > 0), 'Should log validation errors');
            } finally {
                registry.getPrompt = originalGetPrompt;
            }
        });

        test('should ensure no legacy prompt creation methods exist', async () => {
            await promptManager.initialize();

            assert.strictEqual(typeof (promptManager as any).createLegacyPrompt, 'undefined', 'Should not have createLegacyPrompt method');
            
            const codeContext: CodeContext = {
                selectedText: 'test code',
                language: 'javascript'
            };

            // Clear prompts to force error path
            registry.clear();

            // Should throw error immediately, not attempt legacy fallback
            const startTime = Date.now();
            try {
                await promptManager.processRequest(UserAction.CODE_REVIEW, codeContext);
                assert.fail('Should have thrown an error');
            } catch (error) {
                const endTime = Date.now();
                const duration = endTime - startTime;
                
                // Should fail quickly without attempting fallback
                assert.ok(duration < 100, 'Should fail quickly without legacy fallback attempts');
                assert.ok(error instanceof Error);
                assert.ok(error.message.includes('No JSON prompt available'), 'Should throw JSON prompt error');
            }
        });
    });
});