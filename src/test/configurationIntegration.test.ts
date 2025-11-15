import * as assert from 'assert';
import * as vscode from 'vscode';
import { ConfigurationManager } from '../prompt/ConfigurationManager';
import { configChangeHandler } from '../lib/configChangeHandler';

suite('Configuration Integration Tests', () => {
    let configManager: ConfigurationManager;
    let originalGetConfiguration: typeof vscode.workspace.getConfiguration;

    setup(() => {
        configManager = ConfigurationManager.getInstance();
        originalGetConfiguration = vscode.workspace.getConfiguration;
    });

    teardown(() => {
        vscode.workspace.getConfiguration = originalGetConfiguration;
        configChangeHandler.dispose();
    });

    test('should handle real-time configuration updates', (done) => {
        let configurationChanged = false;
        
        // Mock VS Code configuration
        const mockConfig = {
            get: (key: string, defaultValue?: any) => {
                const mockValues: Record<string, any> = {
                    'prompts.experienceLevel': 'advanced',
                    'prompts.maxSuggestions': 10,
                    'prompts.includeExplanations': false,
                    'prompts.customFocusAreas': ['performance', 'security'],
                    'prompts.outputVerbosity': 'detailed',
                    'prompts.enablePromptSystem': true,
                    'prompts.directory': '',
                    'prompts.cachePrompts': true,
                    'prompts.configs': {}
                };
                return mockValues[key] ?? defaultValue;
            },
            has: () => true,
            inspect: () => undefined,
            update: async () => Promise.resolve()
        };

        vscode.workspace.getConfiguration = () => mockConfig as any;

        // Register listener for configuration changes
        const disposable = configChangeHandler.onPromptConfigurationChange((settings) => {
            try {
                assert.strictEqual(settings.experienceLevel, 'advanced');
                assert.strictEqual(settings.maxSuggestions, 10);
                assert.strictEqual(settings.includeExplanations, false);
                assert.deepStrictEqual(settings.customFocusAreas, ['performance', 'security']);
                assert.strictEqual(settings.outputVerbosity, 'detailed');
                
                configurationChanged = true;
                disposable.dispose();
                done();
            } catch (error) {
                disposable.dispose();
                done(error);
            }
        });

        // Initialize handler and trigger configuration change
        configChangeHandler.initialize();
        
        const mockEvent: vscode.ConfigurationChangeEvent = {
            affectsConfiguration: (section: string) => section === 'DebugBuddy.prompts'
        };

        configChangeHandler.onConfigurationChanged(mockEvent);

        // Fallback timeout in case listener is not called
        setTimeout(() => {
            if (!configurationChanged) {
                disposable.dispose();
                done(new Error('Configuration change listener was not called'));
            }
        }, 1000);
    });

    test('should validate configuration on startup', async () => {
        // Mock invalid configuration
        const mockConfig = {
            get: (key: string, defaultValue?: any) => {
                const mockValues: Record<string, any> = {
                    'prompts.experienceLevel': 'invalid-level',
                    'prompts.maxSuggestions': 'not-a-number',
                    'prompts.includeExplanations': 'not-a-boolean',
                    'prompts.customFocusAreas': 'not-an-array',
                    'prompts.outputVerbosity': 'invalid-verbosity',
                    'prompts.enablePromptSystem': 'not-a-boolean',
                    'prompts.directory': 123,
                    'prompts.cachePrompts': 'not-a-boolean',
                    'prompts.configs': {}
                };
                return mockValues[key] ?? defaultValue;
            },
            has: () => true,
            inspect: () => undefined,
            update: async () => Promise.resolve()
        };

        vscode.workspace.getConfiguration = () => mockConfig as any;

        const validation = configManager.validateConfiguration();
        
        assert.strictEqual(validation.isValid, false);
        assert.ok(validation.errors.length > 0);
        
        // Check for specific validation errors
        assert.ok(validation.errors.some(error => error.includes('Invalid experience level')));
        assert.ok(validation.errors.some(error => error.includes('Max suggestions must be an integer')));
        assert.ok(validation.errors.some(error => error.includes('Include explanations must be a boolean')));
        assert.ok(validation.errors.some(error => error.includes('Custom focus areas must be an array')));
        assert.ok(validation.errors.some(error => error.includes('Invalid output verbosity')));
        assert.ok(validation.errors.some(error => error.includes('Enable prompt system must be a boolean')));
        assert.ok(validation.errors.some(error => error.includes('Prompt directory must be a string')));
        assert.ok(validation.errors.some(error => error.includes('Cache prompts must be a boolean')));
    });

    test('should handle configuration migration correctly', async () => {
        let updateCalls: Array<{key: string, value: any}> = [];
        
        // Mock configuration with legacy settings
        const mockConfig = {
            get: (key: string, defaultValue?: any) => {
                const mockValues: Record<string, any> = {
                    'prompts.configVersion': '0.0.0',
                    'prompt.experienceLevel': 'beginner', // Legacy setting
                    'prompt.maxSuggestions': 3, // Legacy setting
                    'prompts.experienceLevel': 'intermediate',
                    'prompts.maxSuggestions': 5,
                    'prompts.includeExplanations': true,
                    'prompts.customFocusAreas': [],
                    'prompts.outputVerbosity': 'standard',
                    'prompts.enablePromptSystem': true,
                    'prompts.directory': '',
                    'prompts.cachePrompts': true,
                    'prompts.configs': {}
                };
                return mockValues[key] ?? defaultValue;
            },
            has: (key: string) => {
                return key === 'prompts.experienceLevel' || 
                       key === 'prompt.experienceLevel' || 
                       key === 'prompt.maxSuggestions';
            },
            inspect: () => undefined,
            update: async (key: string, value: any) => {
                updateCalls.push({key, value});
                return Promise.resolve();
            }
        };

        vscode.workspace.getConfiguration = () => mockConfig as any;

        await configManager.migrateConfiguration();

        assert.ok(updateCalls.some(call => 
            call.key === 'prompts.experienceLevel' && call.value === 'beginner'
        ));
        assert.ok(updateCalls.some(call => 
            call.key === 'prompts.maxSuggestions' && call.value === 3
        ));
        assert.ok(updateCalls.some(call => 
            call.key === 'prompt.experienceLevel' && call.value === undefined
        ));
        assert.ok(updateCalls.some(call => 
            call.key === 'prompt.maxSuggestions' && call.value === undefined
        ));
        assert.ok(updateCalls.some(call => 
            call.key === 'prompts.configVersion' && call.value === '1.0.0'
        ));
    });

    test('should provide configuration summary', () => {
        // Mock valid configuration
        const mockConfig = {
            get: (key: string, defaultValue?: any) => {
                const mockValues: Record<string, any> = {
                    'prompts.experienceLevel': 'advanced',
                    'prompts.maxSuggestions': 8,
                    'prompts.includeExplanations': true,
                    'prompts.customFocusAreas': ['performance', 'security', 'readability'],
                    'prompts.outputVerbosity': 'detailed',
                    'prompts.enablePromptSystem': true,
                    'prompts.directory': '/custom/prompts',
                    'prompts.cachePrompts': false,
                    'prompts.configs': {
                        'code-review': {
                            enabled: true,
                            priority: 2,
                            customSettings: { focus: 'security' },
                            overrides: {}
                        }
                    }
                };
                return mockValues[key] ?? defaultValue;
            },
            has: () => true,
            inspect: () => undefined,
            update: async () => Promise.resolve()
        };

        vscode.workspace.getConfiguration = () => mockConfig as any;

        const summary = configManager.getConfigurationSummary();
        
        assert.ok(typeof summary === 'string');
        assert.ok(summary.includes('Experience Level: advanced'));
        assert.ok(summary.includes('Max Suggestions: 8'));
        assert.ok(summary.includes('Include Explanations: true'));
        assert.ok(summary.includes('Output Verbosity: detailed'));
        assert.ok(summary.includes('Prompt System Enabled: true'));
        assert.ok(summary.includes('Cache Prompts: false'));
        assert.ok(summary.includes('Custom Focus Areas: performance, security, readability'));
        assert.ok(summary.includes('Custom Prompt Directory: /custom/prompts'));
        assert.ok(summary.includes('Configuration Status: Valid'));
    });
});