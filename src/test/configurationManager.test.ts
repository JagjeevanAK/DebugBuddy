import * as assert from 'assert';
import * as vscode from 'vscode';
import { ConfigurationManager, GlobalPromptSettings, PromptConfig } from '../prompt/ConfigurationManager';

suite('ConfigurationManager Tests', () => {
    let configManager: ConfigurationManager;
    let mockConfiguration: any;

    setup(() => {
        configManager = ConfigurationManager.getInstance();
        
        // Mock VS Code configuration
        mockConfiguration = {
            get: (key: string, defaultValue?: any) => {
                const mockValues: Record<string, any> = {
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
            update: async (key: string, value: any, target: vscode.ConfigurationTarget) => {
                // Mock update - in real tests this would update the mock values
                return Promise.resolve();
            }
        };

        // Mock vscode.workspace.getConfiguration
        const originalGetConfiguration = vscode.workspace.getConfiguration;
        vscode.workspace.getConfiguration = (section?: string) => {
            if (section === 'DebugBuddy') {
                return mockConfiguration as vscode.WorkspaceConfiguration;
            }
            return originalGetConfiguration(section);
        };
    });

    test('should return default global settings', () => {
        const settings = configManager.getGlobalSettings();
        
        assert.strictEqual(settings.experienceLevel, 'intermediate');
        assert.strictEqual(settings.maxSuggestions, 5);
        assert.strictEqual(settings.includeExplanations, true);
        assert.deepStrictEqual(settings.customFocusAreas, []);
        assert.strictEqual(settings.outputVerbosity, 'standard');
        assert.strictEqual(settings.enablePromptSystem, true);
        assert.strictEqual(settings.promptDirectory, '');
        assert.strictEqual(settings.cachePrompts, true);
    });

    test('should return default prompt config for unknown prompt', () => {
        const config = configManager.getPromptConfig('unknown-prompt');
        
        assert.strictEqual(config.enabled, true);
        assert.strictEqual(config.priority, 1);
        assert.deepStrictEqual(config.customSettings, {});
        assert.deepStrictEqual(config.overrides, {});
    });

    test('should validate configuration correctly', () => {
        const result = configManager.validateConfiguration();
        
        assert.strictEqual(result.isValid, true);
        assert.strictEqual(result.errors.length, 0);
    });

    test('should detect invalid experience level', () => {
        // Mock invalid experience level
        mockConfiguration.get = (key: string, defaultValue?: any) => {
            if (key === 'prompts.experienceLevel') {
                return 'invalid';
            }
            return defaultValue;
        };

        const result = configManager.validateConfiguration();
        
        assert.strictEqual(result.isValid, false);
        assert.strictEqual(result.errors.length, 1);
        assert.ok(result.errors[0].includes('Invalid experience level'));
    });

    test('should detect invalid max suggestions', () => {
        // Mock invalid max suggestions
        mockConfiguration.get = (key: string, defaultValue?: any) => {
            if (key === 'prompts.maxSuggestions') {
                return 25; // Above maximum
            }
            if (key === 'prompts.experienceLevel') {
                return 'intermediate';
            }
            if (key === 'prompts.outputVerbosity') {
                return 'standard';
            }
            return defaultValue;
        };

        const result = configManager.validateConfiguration();
        
        assert.strictEqual(result.isValid, false);
        assert.strictEqual(result.errors.length, 1);
        assert.ok(result.errors[0].includes('Max suggestions must be an integer between'));
    });

    test('should detect invalid output verbosity', () => {
        // Mock invalid output verbosity
        mockConfiguration.get = (key: string, defaultValue?: any) => {
            if (key === 'prompts.outputVerbosity') {
                return 'invalid';
            }
            if (key === 'prompts.experienceLevel') {
                return 'intermediate';
            }
            if (key === 'prompts.maxSuggestions') {
                return 5;
            }
            return defaultValue;
        };

        const result = configManager.validateConfiguration();
        
        assert.strictEqual(result.isValid, false);
        assert.strictEqual(result.errors.length, 1);
        assert.ok(result.errors[0].includes('Invalid output verbosity'));
    });

    test('should handle configuration change listeners', () => {
        let callbackCalled = false;
        let receivedConfig: any = null;

        const disposable = configManager.onConfigurationChange((config) => {
            callbackCalled = true;
            receivedConfig = config;
        });

        // In a real scenario, this would be triggered by VS Code
        (configManager as any).notifyConfigurationChange();

        assert.strictEqual(callbackCalled, true);
        assert.ok(receivedConfig !== null);
        assert.strictEqual(receivedConfig.experienceLevel, 'intermediate');

        disposable.dispose();
    });

    test('should update global settings', async () => {
        const newSettings: Partial<GlobalPromptSettings> = {
            experienceLevel: 'advanced',
            maxSuggestions: 10
        };

        let updateCalls: Array<{key: string, value: any}> = [];
        mockConfiguration.update = async (key: string, value: any) => {
            updateCalls.push({key, value});
            return Promise.resolve();
        };

        await configManager.updateGlobalSettings(newSettings);

        assert.strictEqual(updateCalls.length, 2);
        assert.ok(updateCalls.some(call => call.key === 'prompts.experienceLevel' && call.value === 'advanced'));
        assert.ok(updateCalls.some(call => call.key === 'prompts.maxSuggestions' && call.value === 10));
    });

    test('should update prompt config', async () => {
        const promptId = 'test-prompt';
        const newConfig: Partial<PromptConfig> = {
            enabled: false,
            priority: 5
        };

        let updateCalls: Array<{key: string, value: any}> = [];
        mockConfiguration.update = async (key: string, value: any) => {
            updateCalls.push({key, value});
            return Promise.resolve();
        };

        await configManager.updatePromptConfig(promptId, newConfig);

        assert.strictEqual(updateCalls.length, 1);
        assert.strictEqual(updateCalls[0].key, 'prompts.configs');
        assert.ok(updateCalls[0].value[promptId]);
        assert.strictEqual(updateCalls[0].value[promptId].enabled, false);
        assert.strictEqual(updateCalls[0].value[promptId].priority, 5);
    });

    test('should validate prompt configuration with invalid types', () => {
        // Mock invalid configuration values
        mockConfiguration.get = (key: string, defaultValue?: any) => {
            const mockValues: Record<string, any> = {
                'prompts.experienceLevel': 'invalid',
                'prompts.maxSuggestions': 'not-a-number',
                'prompts.includeExplanations': 'not-a-boolean',
                'prompts.customFocusAreas': 'not-an-array',
                'prompts.outputVerbosity': 'invalid',
                'prompts.enablePromptSystem': 'not-a-boolean',
                'prompts.directory': 123,
                'prompts.cachePrompts': 'not-a-boolean',
                'prompts.configs': {}
            };
            return mockValues[key] ?? defaultValue;
        };

        const result = configManager.validateConfiguration();
        
        assert.strictEqual(result.isValid, false);
        assert.ok(result.errors.length > 0);
        assert.ok(result.errors.some(error => error.includes('Invalid experience level')));
        assert.ok(result.errors.some(error => error.includes('Max suggestions must be an integer')));
        assert.ok(result.errors.some(error => error.includes('Include explanations must be a boolean')));
        assert.ok(result.errors.some(error => error.includes('Custom focus areas must be an array')));
        assert.ok(result.errors.some(error => error.includes('Invalid output verbosity')));
        assert.ok(result.errors.some(error => error.includes('Enable prompt system must be a boolean')));
        assert.ok(result.errors.some(error => error.includes('Prompt directory must be a string')));
        assert.ok(result.errors.some(error => error.includes('Cache prompts must be a boolean')));
    });

    test('should validate individual prompt configurations', () => {
        // Mock configuration with invalid prompt configs
        mockConfiguration.get = (key: string, defaultValue?: any) => {
            const mockValues: Record<string, any> = {
                'prompts.experienceLevel': 'intermediate',
                'prompts.maxSuggestions': 5,
                'prompts.includeExplanations': true,
                'prompts.customFocusAreas': [],
                'prompts.outputVerbosity': 'standard',
                'prompts.enablePromptSystem': true,
                'prompts.directory': '',
                'prompts.cachePrompts': true,
                'prompts.configs': {
                    'test-prompt': {
                        enabled: 'not-a-boolean',
                        priority: -1,
                        customSettings: null,
                        overrides: 'not-an-object'
                    }
                }
            };
            return mockValues[key] ?? defaultValue;
        };

        const result = configManager.validateConfiguration();
        
        assert.strictEqual(result.isValid, false);
        assert.ok(result.errors.some(error => error.includes('test-prompt: enabled must be a boolean')));
        assert.ok(result.errors.some(error => error.includes('test-prompt: priority must be a non-negative integer')));
        assert.ok(result.errors.some(error => error.includes('test-prompt: customSettings must be an object')));
        assert.ok(result.errors.some(error => error.includes('test-prompt: overrides must be an object')));
    });

    test('should handle configuration migration for first-time users', async () => {
        // Mock fresh installation (no prompt settings)
        mockConfiguration.has = (key: string) => false;
        
        let updateCalls: Array<{key: string, value: any}> = [];
        mockConfiguration.update = async (key: string, value: any) => {
            updateCalls.push({key, value});
            return Promise.resolve();
        };

        await configManager.migrateConfiguration();

        // Should initialize all default settings
        assert.ok(updateCalls.length > 0);
        assert.ok(updateCalls.some(call => call.key === 'prompts.experienceLevel' && call.value === 'intermediate'));
        assert.ok(updateCalls.some(call => call.key === 'prompts.maxSuggestions' && call.value === 5));
        assert.ok(updateCalls.some(call => call.key === 'prompts.configVersion' && call.value === '1.0.0'));
    });

    test('should handle configuration migration from legacy version', async () => {
        // Mock existing configuration that needs migration
        mockConfiguration.has = (key: string) => {
            return key === 'prompts.experienceLevel' || key === 'prompt.experienceLevel';
        };
        
        mockConfiguration.get = (key: string, defaultValue?: any) => {
            const mockValues: Record<string, any> = {
                'prompts.configVersion': '0.0.0',
                'prompt.experienceLevel': 'advanced', // Legacy setting
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
        };

        let updateCalls: Array<{key: string, value: any}> = [];
        mockConfiguration.update = async (key: string, value: any) => {
            updateCalls.push({key, value});
            return Promise.resolve();
        };

        await configManager.migrateConfiguration();

        // Should migrate legacy settings and update version
        assert.ok(updateCalls.some(call => call.key === 'prompts.experienceLevel' && call.value === 'advanced'));
        assert.ok(updateCalls.some(call => call.key === 'prompt.experienceLevel' && call.value === undefined));
        assert.ok(updateCalls.some(call => call.key === 'prompts.configVersion' && call.value === '1.0.0'));
    });

    test('should reset configuration to defaults', async () => {
        let updateCalls: Array<{key: string, value: any}> = [];
        mockConfiguration.update = async (key: string, value: any) => {
            updateCalls.push({key, value});
            return Promise.resolve();
        };

        await configManager.resetToDefaults();

        // Should reset all settings to defaults
        assert.ok(updateCalls.some(call => call.key === 'prompts.experienceLevel' && call.value === 'intermediate'));
        assert.ok(updateCalls.some(call => call.key === 'prompts.maxSuggestions' && call.value === 5));
        assert.ok(updateCalls.some(call => call.key === 'prompts.includeExplanations' && call.value === true));
        assert.ok(updateCalls.some(call => call.key === 'prompts.configs' && JSON.stringify(call.value) === '{}'));
    });

    test('should generate configuration summary', () => {
        const summary = configManager.getConfigurationSummary();
        
        assert.ok(typeof summary === 'string');
        assert.ok(summary.includes('Experience Level: intermediate'));
        assert.ok(summary.includes('Max Suggestions: 5'));
        assert.ok(summary.includes('Configuration Status: Valid'));
    });
});