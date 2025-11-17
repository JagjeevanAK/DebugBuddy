import * as assert from 'assert';
import * as vscode from 'vscode';
import { configChangeHandler } from '../../lib/configChangeHandler';
import { apiKeyCache } from '../../lib/apiKeyCache';

suite('Configuration Change Handler Tests', () => {
  
  setup(() => {
    apiKeyCache.clear();
  });

  teardown(() => {
    configChangeHandler.dispose();
    apiKeyCache.clear();
  });

  test('should detect API key configuration changes', () => {
    configChangeHandler.initialize();

    const mockEvent: vscode.ConfigurationChangeEvent = {
      affectsConfiguration: (section: string) => section === 'DebugBuddy.apiKey'
    };

    const originalGetConfiguration = vscode.workspace.getConfiguration;
    vscode.workspace.getConfiguration = (section?: string) => ({
      get: (key: string) => key === 'apiKey' ? 'test-api-key-123' : undefined,
      has: () => true,
      inspect: () => undefined,
      update: () => Promise.resolve()
    } as any);

    configChangeHandler.onConfigurationChanged(mockEvent);

    assert.strictEqual(apiKeyCache.get(), 'test-api-key-123');
    assert.strictEqual(apiKeyCache.isInitialized(), true);

    vscode.workspace.getConfiguration = originalGetConfiguration;
  });

  test('should ignore non-API key configuration changes', () => {
    configChangeHandler.initialize();

    const mockEvent: vscode.ConfigurationChangeEvent = {
      affectsConfiguration: (section: string) => section === 'DebugBuddy.otherSetting'
    };

    configChangeHandler.onConfigurationChanged(mockEvent);

    assert.strictEqual(apiKeyCache.isInitialized(), false);
    assert.strictEqual(apiKeyCache.get(), undefined);
  });

  test('should handle undefined API key values', () => {
    configChangeHandler.initialize();

    const mockEvent: vscode.ConfigurationChangeEvent = {
      affectsConfiguration: (section: string) => section === 'DebugBuddy.apiKey'
    };

    const originalGetConfiguration = vscode.workspace.getConfiguration;
    vscode.workspace.getConfiguration = (section?: string) => ({
      get: (key: string) => undefined,
      has: () => true,
      inspect: () => undefined,
      update: () => Promise.resolve()
    } as any);

    configChangeHandler.onConfigurationChanged(mockEvent);

    assert.strictEqual(apiKeyCache.get(), undefined);
    assert.strictEqual(apiKeyCache.isInitialized(), true);

    vscode.workspace.getConfiguration = originalGetConfiguration;
  });

  test('should handle errors gracefully', () => {
    configChangeHandler.initialize();

    const mockEvent: vscode.ConfigurationChangeEvent = {
      affectsConfiguration: (section: string) => {
        throw new Error('Test error');
      }
    };

    assert.doesNotThrow(() => {
      configChangeHandler.onConfigurationChanged(mockEvent);
    });

    assert.strictEqual(apiKeyCache.isInitialized(), false);
  });

  test('should properly dispose of listeners', () => {
    configChangeHandler.initialize();

    assert.doesNotThrow(() => {
      configChangeHandler.dispose();
    });

    assert.doesNotThrow(() => {
      configChangeHandler.dispose();
    });
  });

  test('should handle cache update failures during configuration change', () => {
    configChangeHandler.initialize();

    const mockEvent: vscode.ConfigurationChangeEvent = {
      affectsConfiguration: (section: string) => section === 'DebugBuddy.apiKey'
    };

    const originalGetConfiguration = vscode.workspace.getConfiguration;
    vscode.workspace.getConfiguration = (section?: string) => ({
      get: (key: string) => key === 'apiKey' ? 'test-key-cache-fail' : undefined,
      has: () => true,
      inspect: () => undefined,
      update: () => Promise.resolve()
    } as any);

    const originalSet = apiKeyCache.set;
    apiKeyCache.set = () => {
      throw new Error('Cache set failed');
    };

    try {
      assert.doesNotThrow(() => {
        configChangeHandler.onConfigurationChanged(mockEvent);
      });

    } finally {
      vscode.workspace.getConfiguration = originalGetConfiguration;
      apiKeyCache.set = originalSet;
    }
  });

  test('should handle VSCode configuration access failures', () => {
    configChangeHandler.initialize();

    const mockEvent: vscode.ConfigurationChangeEvent = {
      affectsConfiguration: (section: string) => section === 'DebugBuddy.apiKey'
    };

    const originalGetConfiguration = vscode.workspace.getConfiguration;
    vscode.workspace.getConfiguration = (section?: string) => {
      throw new Error('VSCode configuration access failed');
    };

    try {
      assert.doesNotThrow(() => {
        configChangeHandler.onConfigurationChanged(mockEvent);
      });

      assert.strictEqual(apiKeyCache.isInitialized(), false);

    } finally {
      vscode.workspace.getConfiguration = originalGetConfiguration;
    }
  });

  test('should handle initialization failures gracefully', () => {
    assert.doesNotThrow(() => {
      configChangeHandler.initialize();
    });

    assert.doesNotThrow(() => {
      configChangeHandler.initialize();
    });
  });

  test('should handle prompt configuration changes', () => {
    configChangeHandler.initialize();

    const mockEvent: vscode.ConfigurationChangeEvent = {
      affectsConfiguration: (section: string) => section === 'DebugBuddy.prompts'
    };

    const originalGetConfiguration = vscode.workspace.getConfiguration;
    vscode.workspace.getConfiguration = (section?: string) => ({
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
      has: () => true,
      inspect: () => undefined,
      update: () => Promise.resolve()
    } as any);

    assert.doesNotThrow(() => {
      configChangeHandler.onConfigurationChanged(mockEvent);
    });

    vscode.workspace.getConfiguration = originalGetConfiguration;
  });
});