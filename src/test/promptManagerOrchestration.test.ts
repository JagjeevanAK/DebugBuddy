/**
 * Integration tests for PromptManager orchestration layer
 * Tests the complete prompt processing flow and component coordination
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
    ProcessedPrompt 
} from '../prompt/types';

// Mock VS Code API for testing
const mockVscode = {
    workspace: {
        getConfiguration: () => ({
            get: (key: string, defaultValue?: any) => defaultValue,
            has: () => false,
            update: async () => {},
        }),
        onDidChangeConfiguration: () => ({ dispose: () => {} })
    },
    window: {
        createOutputChannel: () => ({
            appendLine: () => {},
            show: () => {}
        })
    }
};

(global as any).vscode = mockVscode;

suite('PromptManager Orchestration Integration Tests', () => {
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

    suite('Component Orchestration', () => {
        test('should coordinate all components in processRequest', async () => {
            await promptManager.initialize();

            const testPrompt: JsonPrompt = {
                id: 'test-orchestration',
                name: 'Test Orchestration Prompt',
                description: 'A test prompt for orchestration testing',
                category: PromptCategory.CODE_REVIEW,
                version: '1.0.0',
                schema_version: '1.0',
                template: {
                    task: 'Review the ${code} for quality issues',
                    instructions: 'Analyze the provided code and suggest improvements',
                    context: { focus: 'quality' },
                    output_format: { 
                        structure: 'list',
                        include_line_numbers: true,
                        include_severity: true
                    },
                    variables: ['code', 'language', 'experienceLevel']
                },
                config: {
                    configurable_fields: ['focus'],
                    default_values: { focus: 'quality' },
                    validation_rules: {}
                }
            };

            registry.registerPrompt('code-review', testPrompt);

            const codeContext: CodeContext = {
                selectedText: 'function test() { return "hello"; }',
                fullText: 'function test() { return "hello"; }',
                filePath: '/test/example.js',
                language: 'javascript',
                lineNumber: 1,
                columnNumber: 1
            };

            const result = await promptManager.processRequest(UserAction.CODE_REVIEW, codeContext);

            assert.ok(result, 'Should return a processed prompt');
            assert.ok(result.content, 'Should have content');
            assert.ok(result.metadata, 'Should have metadata');
            assert.ok(Array.isArray(result.variables_used), 'Should have variables_used array');

            assert.ok(result.variables_used.length > 0, 'Should have used variables');
            assert.ok(result.variables_used.includes('code') || result.variables_used.includes('selectedCode'), 'Should include code variable');
            assert.ok(result.variables_used.includes('language'), 'Should include language variable');
        });

        test('should handle end-to-end prompt processing with all components', async () => {
            await promptManager.initialize();

            const codeContext: CodeContext = {
                selectedText: 'const x = 1; console.log(x);',
                language: 'javascript',
                filePath: '/project/test.js',
                errorMessage: 'Unused variable warning',
                diagnostics: [{
                    message: 'Variable x is declared but never used',
                    source: 'eslint',
                    severity: 2
                }]
            };

            const actions = [
                UserAction.CODE_REVIEW,
                UserAction.DEBUG_ERROR,
                UserAction.REFACTOR
            ];

            for (const action of actions) {
                const result = await promptManager.processRequest(action, codeContext);
                
                assert.ok(result, `Should process ${action} request`);
                assert.ok(result.content, `Should have content for ${action}`);
                assert.ok(result.variables_used.length > 0, `Should use variables for ${action}`);
            }
        });

        test('should coordinate context analysis with prompt selection', async () => {
            await promptManager.initialize();

            const jsContext: CodeContext = {
                selectedText: 'function calculate() {}',
                language: 'javascript',
                filePath: '/src/calculator.js'
            };

            const errorContext: CodeContext = {
                selectedText: 'function calculate() {}',
                language: 'javascript',
                filePath: '/src/calculator.js',
                errorMessage: 'SyntaxError: Unexpected token',
                diagnostics: [{
                    message: 'Unexpected token',
                    source: 'javascript',
                    severity: 1
                }]
            };

            const reviewResult = await promptManager.processRequest(UserAction.CODE_REVIEW, jsContext);
            const debugResult = await promptManager.processRequest(UserAction.DEBUG_ERROR, errorContext);

            // Results should reflect different context analysis
            assert.ok(reviewResult, 'Should process code review');
            assert.ok(debugResult, 'Should process debug request');
            
            // Debug result should include error-specific variables
            assert.ok(debugResult.variables_used.includes('errorMessage'), 'Debug should include error message');
            
            // Both should include common variables but may have different processing
            assert.ok(reviewResult.variables_used.includes('language'), 'Review should include language');
            assert.ok(debugResult.variables_used.includes('language'), 'Debug should include language');
        });

        test('should coordinate template engine with configuration manager', async () => {
            await promptManager.initialize();

            const configManager = ConfigurationManager.getInstance();
            
            // Update configuration
            await configManager.updateGlobalSettings({
                experienceLevel: 'advanced',
                maxSuggestions: 8,
                outputVerbosity: 'detailed'
            });

            const codeContext: CodeContext = {
                selectedText: 'const data = [];',
                language: 'javascript'
            };

            const result = await promptManager.processRequest(UserAction.CODE_REVIEW, codeContext);

            // Configuration should be reflected in variable processing
            assert.ok(result.variables_used.includes('experienceLevel'), 'Should include experience level');
            assert.ok(result.variables_used.includes('maxSuggestions'), 'Should include max suggestions');
            assert.ok(result.variables_used.includes('outputVerbosity'), 'Should include output verbosity');
        });

        test('should coordinate validation with error handling', async () => {
            await promptManager.initialize();

            const invalidPrompt = {
                id: 'invalid-orchestration-test',
                name: 'Invalid Test',
                description: 'Invalid prompt for testing orchestration',
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

            // Force the system to try to use the invalid prompt
            const originalGetPrompt = registry.getPrompt;
            registry.getPrompt = (name: string) => {
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

                // Error handling should have logged the validation error
                const errorStats = promptErrorHandler.getErrorStats();
                assert.ok(Object.keys(errorStats).length > 0, 'Should have error statistics');
            } finally {
                // Restore original method
                registry.getPrompt = originalGetPrompt;
            }
        });
    });

    suite('System Health and Statistics', () => {
        test('should provide comprehensive system statistics', async () => {
            await promptManager.initialize();

            const stats = promptManager.getStats();

            assert.ok(stats.initialized, 'Should report initialization status');
            assert.ok(stats.promptSystem, 'Should include prompt system stats');
            assert.ok(stats.errorStats, 'Should include error statistics');
            assert.ok(stats.recoveryCapabilities, 'Should include recovery capabilities');

            assert.ok(typeof stats.promptSystem.totalPrompts === 'number', 'Should have total prompts count');
            assert.ok(typeof stats.promptSystem.promptsByCategory === 'object', 'Should have prompts by category');
        });

        test('should perform comprehensive health check', async () => {
            await promptManager.initialize();

            const healthCheck = promptManager.performHealthCheck();

            assert.ok(typeof healthCheck.healthy === 'boolean', 'Should have healthy status');
            assert.ok(Array.isArray(healthCheck.issues), 'Should have issues array');
            assert.ok(Array.isArray(healthCheck.recommendations), 'Should have recommendations array');

            // If healthy, should have no issues
            if (healthCheck.healthy) {
                assert.strictEqual(healthCheck.issues.length, 0, 'Healthy system should have no issues');
            } else {
                assert.ok(healthCheck.issues.length > 0, 'Unhealthy system should have issues');
                assert.ok(healthCheck.recommendations.length > 0, 'Should provide recommendations for issues');
            }
        });

        test('should track available prompt types correctly', async () => {
            await promptManager.initialize();

            const availableTypes = promptManager.getAvailablePromptTypes();

            assert.ok(Array.isArray(availableTypes), 'Should return array of prompt types');
            
            // Each type should be a non-empty string
            availableTypes.forEach(type => {
                assert.strictEqual(typeof type, 'string', 'Each prompt type should be a string');
                assert.ok(type.length > 0, 'Each prompt type should be non-empty');
            });
        });
    });

    suite('Error Recovery and JSON-Only Orchestration', () => {
        test('should handle missing prompts with proper error orchestration', async () => {
            await promptManager.initialize();

            // Clear all prompts to simulate not found scenario
            registry.clear();

            const codeContext: CodeContext = {
                selectedText: 'function test() {}',
                language: 'javascript'
            };

            // Should throw error when prompts not found
            await assert.rejects(
                async () => await promptManager.processRequest(UserAction.CODE_REVIEW, codeContext),
                /No JSON prompt available/
            );

            // Error handling should be coordinated
            const errorStats = promptErrorHandler.getErrorStats();
            assert.ok(Object.values(errorStats).some(stat => stat.count > 0), 'Should log errors');
        });

        test('should handle concurrent requests with proper orchestration', async () => {
            await promptManager.initialize();

            const codeContext: CodeContext = {
                selectedText: 'const value = 42;',
                language: 'javascript'
            };

            const startTime = Date.now();

            // Process multiple concurrent requests
            const concurrentRequests = Array(5).fill(null).map(() =>
                promptManager.processRequest(UserAction.CODE_REVIEW, codeContext)
            );

            const results = await Promise.all(concurrentRequests);
            const endTime = Date.now();

            // All requests should succeed
            assert.strictEqual(results.length, 5, 'Should process all concurrent requests');
            results.forEach((result, index) => {
                assert.ok(result, `Request ${index} should succeed`);
                assert.ok(result.content, `Request ${index} should have content`);
                assert.ok(result.variables_used.length > 0, `Request ${index} should use variables`);
            });

            // Should complete in reasonable time
            const duration = endTime - startTime;
            assert.ok(duration < 3000, `Concurrent requests should complete quickly, took ${duration}ms`);
        });

        test('should orchestrate variable preparation comprehensively', async () => {
            await promptManager.initialize();

            const comprehensiveContext: CodeContext = {
                selectedText: 'function calculateTotal(items) { return items.reduce((sum, item) => sum + item.price, 0); }',
                fullText: 'const items = []; function calculateTotal(items) { return items.reduce((sum, item) => sum + item.price, 0); }',
                filePath: '/project/src/utils/calculator.ts',
                language: 'typescript',
                lineNumber: 2,
                columnNumber: 1,
                errorMessage: 'Type error: Property price does not exist',
                diagnostics: [{
                    message: 'Property price does not exist on type unknown',
                    source: 'typescript',
                    severity: 1
                }],
                surroundingCode: 'const items = [];\nfunction calculateTotal(items) {\n  return items.reduce((sum, item) => sum + item.price, 0);\n}'
            };

            const result = await promptManager.processRequest(UserAction.CODE_REVIEW, comprehensiveContext);

            // Should prepare comprehensive variable map
            const expectedVariables = [
                'language', 'selectedCode', 'code', 'filePath', 'fileName',
                'errorMessage', 'lineNumber', 'experienceLevel'
            ];

            expectedVariables.forEach(variable => {
                const hasVariable = result.variables_used.includes(variable) || 
                                  result.variables_used.some(v => v.includes(variable));
                assert.ok(hasVariable, `Should include variable: ${variable}`);
            });

            // Should handle language-specific processing
            assert.ok(result.variables_used.includes('languageSpecificCriteria'), 'Should include language-specific criteria');
            assert.ok(result.variables_used.includes('experienceLevelGuidance'), 'Should include experience level guidance');
        });
    });

    suite('JSON-Only Error Handling Orchestration', () => {
        test('should handle missing JSON prompts with proper errors for different actions', async () => {
            // Initialize first, then clear the registry to force error scenarios
            await promptManager.initialize();
            registry.clear();
            
            const actions = [
                UserAction.CODE_REVIEW,
                UserAction.DEBUG_ERROR,
                UserAction.REFACTOR,
                UserAction.GENERATE_DOCS
            ];

            for (const action of actions) {
                const codeContext: CodeContext = {
                    selectedText: 'test code for ' + action,
                    language: 'javascript',
                    errorMessage: action === UserAction.DEBUG_ERROR ? 'Test error message' : undefined
                };

                // Should throw error when no JSON prompts are available
                await assert.rejects(
                    async () => await promptManager.processRequest(action, codeContext),
                    /No JSON prompt available/,
                    `Should throw error for action ${action}`
                );
            }
        });

        test('should orchestrate proper error handling without legacy fallback', async () => {
            await promptManager.initialize();

            const testScenarios = [
                {
                    name: 'No prompts available',
                    setup: () => registry.clear(),
                    expectedError: /No JSON prompt available/
                },
                {
                    name: 'Specific prompt missing',
                    setup: () => {
                        registry.clear();
                        const testPrompt: JsonPrompt = {
                            id: 'other-prompt',
                            name: 'Other Prompt',
                            description: 'Different prompt',
                            category: PromptCategory.REFACTORING,
                            version: '1.0.0',
                            schema_version: '1.0',
                            template: {
                                task: 'Other task',
                                instructions: 'Other instructions',
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
                        registry.registerPrompt('other-prompt', testPrompt);
                    },
                    expectedError: /No JSON prompt available.*Available prompt types.*other-prompt/
                }
            ];

            for (const scenario of testScenarios) {
                scenario.setup();

                const codeContext: CodeContext = {
                    selectedText: 'test code',
                    language: 'javascript'
                };

                await assert.rejects(
                    async () => await promptManager.processRequest(UserAction.CODE_REVIEW, codeContext),
                    scenario.expectedError,
                    `Should handle ${scenario.name} scenario properly`
                );

                const errorStats = promptErrorHandler.getErrorStats();
                assert.ok(Object.values(errorStats).some(stat => stat.count > 0), 
                    `Should log errors for ${scenario.name} scenario`);
            }
        });

        test('should coordinate validation errors without legacy fallback', async () => {
            await promptManager.initialize();

            // Create an invalid prompt that will fail validation
            const invalidPrompt = {
                id: 'orchestration-invalid',
                name: 'Invalid Orchestration Test',
                description: 'Invalid prompt for orchestration testing',
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

            registry.registerPrompt('orchestration-invalid', invalidPrompt);

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

                // Should coordinate validation error handling across all components
                await assert.rejects(
                    async () => await promptManager.processRequest(UserAction.CODE_REVIEW, codeContext),
                    /validation failed/i,
                    'Should coordinate validation error without legacy fallback'
                );

                const errorStats = promptErrorHandler.getErrorStats();
                assert.ok(Object.keys(errorStats).length > 0, 'Should have error statistics from coordinated error handling');
            } finally {
                registry.getPrompt = originalGetPrompt;
            }
        });

        test('should verify JSON-only orchestration performance', async () => {
            await promptManager.initialize();

            const validPrompt: JsonPrompt = {
                id: 'performance-test',
                name: 'Performance Test Prompt',
                description: 'Prompt for performance testing',
                category: PromptCategory.CODE_REVIEW,
                version: '1.0.0',
                schema_version: '1.0',
                template: {
                    task: 'Review ${code} for performance',
                    instructions: 'Analyze the code for performance issues',
                    context: { focus: 'performance' },
                    output_format: { structure: 'list' },
                    variables: ['code', 'language']
                },
                config: {
                    configurable_fields: ['focus'],
                    default_values: { focus: 'performance' },
                    validation_rules: {}
                }
            };

            registry.registerPrompt('code-review', validPrompt);

            const codeContext: CodeContext = {
                selectedText: 'function test() { return "hello"; }',
                language: 'javascript'
            };

            const startTime = Date.now();
            const result = await promptManager.processRequest(UserAction.CODE_REVIEW, codeContext);
            const endTime = Date.now();

            assert.ok(result, 'Should successfully process with JSON-only approach');
            assert.ok(result.content, 'Should have content');
            assert.ok(result.variables_used.length > 0, 'Should use variables');

            // Should be fast without legacy fallback overhead
            const duration = endTime - startTime;
            assert.ok(duration < 1000, `JSON-only processing should be fast, took ${duration}ms`);
        });
    });
});