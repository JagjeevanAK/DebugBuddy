/**
 * Basic integration tests for PromptManager orchestration layer
 * Tests core functionality without VS Code dependencies
 */

import * as assert from 'assert';
import { PromptManager } from '../prompt/PromptManager';
import { PromptSystem } from '../prompt/PromptSystem';
import { PromptRegistry } from '../prompt/PromptRegistry';
import { UserAction, CodeContext, JsonPrompt, PromptCategory } from '../prompt/types';

// Mock VS Code module to avoid dependencies
const mockVscode = {
    workspace: {
        getConfiguration: () => ({
            get: (key: string, defaultValue?: any) => defaultValue,
            has: () => false,
            update: async () => {}
        }),
        onDidChangeConfiguration: () => ({ dispose: () => {} })
    },
    window: {
        createOutputChannel: () => ({
            appendLine: () => {}
        })
    },
    ConfigurationTarget: {
        Global: 1,
        Workspace: 2
    },
    Disposable: class {
        constructor(private callback: () => void) {}
        dispose() { this.callback(); }
    }
};

// Mock the vscode module
(global as any).vscode = mockVscode;

suite('PromptManager Basic Integration Tests', () => {
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
        
        // Reset the manager initialization state
        (promptManager as any).initialized = false;
    });

    test('should create PromptManager instance', () => {
        assert.ok(promptManager);
        assert.strictEqual(typeof promptManager.initialize, 'function');
        assert.strictEqual(typeof promptManager.processRequest, 'function');
    });

    test('should initialize successfully', async () => {
        await promptManager.initialize();
        assert.strictEqual(promptManager.isInitialized(), true);
    });

    test('should provide available prompt types', async () => {
        await promptManager.initialize();
        const availableTypes = promptManager.getAvailablePromptTypes();
        assert.ok(Array.isArray(availableTypes));
    });

    test('should validate prompt integrity', async () => {
        const testPrompt: JsonPrompt = {
            id: 'test-prompt',
            name: 'Test Prompt',
            description: 'A test prompt',
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

        registry.registerPrompt('test-prompt', testPrompt);
        await promptManager.initialize();

        const validationResults = promptManager.validatePromptIntegrity();
        assert.ok(Array.isArray(validationResults));
        
        const testResult = validationResults.find(r => r.name === 'test-prompt');
        assert.ok(testResult);
        assert.strictEqual(testResult.isValid, true);
    });

    test('should process code review request', async () => {
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
        assert.ok(Array.isArray(result.variables_used));
    });

    test('should handle missing prompts with proper error', async () => {
        await promptManager.initialize();
        
        // Clear all prompts to simulate not found scenario
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

    test('should verify JSON-only behavior without legacy fallback', async () => {
        await promptManager.initialize();
        
        assert.strictEqual(typeof (promptManager as any).createLegacyPrompt, 'undefined', 'Should not have createLegacyPrompt method');
        
        // Clear prompts and verify immediate error without fallback attempts
        registry.clear();

        const codeContext: CodeContext = {
            selectedText: 'test code',
            language: 'javascript'
        };

        const startTime = Date.now();
        try {
            await promptManager.processRequest(UserAction.CODE_REVIEW, codeContext);
            assert.fail('Should have thrown an error');
        } catch (error) {
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            // Should fail quickly without legacy fallback attempts
            assert.ok(duration < 50, 'Should fail quickly without legacy fallback');
            assert.ok(error instanceof Error);
            assert.ok(error.message.includes('No JSON prompt available'), 'Should throw JSON prompt error');
        }
    });

    test('should provide system statistics', async () => {
        await promptManager.initialize();

        const stats = promptManager.getStats();

        assert.ok(stats.initialized);
        assert.ok(stats.promptSystem);
        assert.ok(stats.errorStats);
        assert.ok(stats.recoveryCapabilities);
    });

    test('should perform health check', async () => {
        await promptManager.initialize();

        const healthCheck = promptManager.performHealthCheck();

        assert.ok(typeof healthCheck.healthy === 'boolean');
        assert.ok(Array.isArray(healthCheck.issues));
        assert.ok(Array.isArray(healthCheck.recommendations));
    });

    test('should handle debug error request', async () => {
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

    test('should handle concurrent requests', async () => {
        await promptManager.initialize();

        const codeContext: CodeContext = {
            selectedText: 'const x = 1;',
            language: 'javascript'
        };

        // Process multiple concurrent requests
        const concurrentRequests = Array(5).fill(null).map(() =>
            promptManager.processRequest(UserAction.CODE_REVIEW, codeContext)
        );

        const results = await Promise.all(concurrentRequests);

        // All requests should succeed
        assert.strictEqual(results.length, 5);
        results.forEach(result => {
            assert.ok(result);
            assert.ok(result.content);
        });
    });

    test('should handle validation errors without legacy fallback', async () => {
        await promptManager.initialize();

        const invalidPrompt = {
            id: 'invalid-basic-test',
            name: 'Invalid Basic Test',
            description: 'Invalid prompt for basic testing',
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

        registry.registerPrompt('invalid-basic-test', invalidPrompt);

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
        } finally {
            registry.getPrompt = originalGetPrompt;
        }
    });
});