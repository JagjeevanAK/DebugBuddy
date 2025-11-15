/**
 * Tests for Configuration Change Handler
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { configChangeHandler } from '../lib/configChangeHandler';
import { apiKeyCache } from '../lib/apiKeyCache';

suite('Configuration Change Handler Tests', () => {
  
  setup(() => {
    // Clear cache before each test
    apiKeyCache.clear();
  });

  teardown(() => {
    // Clean up after each test
    configChangeHandler.dispose();
    apiKeyCache.clear();
  });

  test('should detect API key configuration changes', () => {
    // Initialize the handler
    configChangeHandler.initialize();

    // Mock configuration change event
    const mockEvent: vscode.ConfigurationChangeEvent = {
      affectsConfiguration: (section: string) => section === 'DebugBuddy.apiKey'
    };

    // Mock the workspace configuration
    const originalGetConfiguration = vscode.workspace.getConfiguration;
    vscode.workspace.getConfiguration = (section?: string) => ({
      get: (key: string) => key === 'apiKey' ? 'test-api-key-123' : undefined,
      has: () => true,
      inspect: () => undefined,
      update: () => Promise.resolve()
    } as any);

    // Trigger configuration change
    configChangeHandler.onConfigurationChanged(mockEvent);

    assert.strictEqual(apiKeyCache.get(), 'test-api-key-123');
    assert.strictEqual(apiKeyCache.isInitialized(), true);

    // Restore original function
    vscode.workspace.getConfiguration = originalGetConfiguration;
  });

  test('should ignore non-API key configuration changes', () => {
    // Initialize the handler
    configChangeHandler.initialize();

    // Mock configuration change event for different setting
    const mockEvent: vscode.ConfigurationChangeEvent = {
      affectsConfiguration: (section: string) => section === 'DebugBuddy.otherSetting'
    };

    // Trigger configuration change
    configChangeHandler.onConfigurationChanged(mockEvent);

    assert.strictEqual(apiKeyCache.isInitialized(), false);
    assert.strictEqual(apiKeyCache.get(), undefined);
  });

  test('should handle undefined API key values', () => {
    // Initialize the handler
    configChangeHandler.initialize();

    // Mock configuration change event
    const mockEvent: vscode.ConfigurationChangeEvent = {
      affectsConfiguration: (section: string) => section === 'DebugBuddy.apiKey'
    };

    // Mock the workspace configuration with undefined API key
    const originalGetConfiguration = vscode.workspace.getConfiguration;
    vscode.workspace.getConfiguration = (section?: string) => ({
      get: (key: string) => undefined,
      has: () => true,
      inspect: () => undefined,
      update: () => Promise.resolve()
    } as any);

    // Trigger configuration change
    configChangeHandler.onConfigurationChanged(mockEvent);

    assert.strictEqual(apiKeyCache.get(), undefined);
    assert.strictEqual(apiKeyCache.isInitialized(), true);

    // Restore original function
    vscode.workspace.getConfiguration = originalGetConfiguration;
  });

  test('should handle errors gracefully', () => {
    // Initialize the handler
    configChangeHandler.initialize();

    // Mock configuration change event
    const mockEvent: vscode.ConfigurationChangeEvent = {
      affectsConfiguration: (section: string) => {
        throw new Error('Test error');
      }
    };

    // This should not throw an error
    assert.doesNotThrow(() => {
      configChangeHandler.onConfigurationChanged(mockEvent);
    });

    // Cache should remain uninitialized
    assert.strictEqual(apiKeyCache.isInitialized(), false);
  });

  test('should properly dispose of listeners', () => {
    // Initialize the handler
    configChangeHandler.initialize();

    // Dispose should not throw
    assert.doesNotThrow(() => {
      configChangeHandler.dispose();
    });

    // Multiple dispose calls should be safe
    assert.doesNotThrow(() => {
      configChangeHandler.dispose();
    });
  });

  test('should handle cache update failures during configuration change', () => {
    // Initialize the handler
    configChangeHandler.initialize();

    // Mock configuration change event
    const mockEvent: vscode.ConfigurationChangeEvent = {
      affectsConfiguration: (section: string) => section === 'DebugBuddy.apiKey'
    };

    // Mock the workspace configuration
    const originalGetConfiguration = vscode.workspace.getConfiguration;
    vscode.workspace.getConfiguration = (section?: string) => ({
      get: (key: string) => key === 'apiKey' ? 'test-key-cache-fail' : undefined,
      has: () => true,
      inspect: () => undefined,
      update: () => Promise.resolve()
    } as any);

    // Mock cache to throw error on set
    const originalSet = apiKeyCache.set;
    apiKeyCache.set = () => {
      throw new Error('Cache set failed');
    };

    try {
      // Should not throw despite cache failure
      assert.doesNotThrow(() => {
        configChangeHandler.onConfigurationChanged(mockEvent);
      });

    } finally {
      // Restore original functions
      vscode.workspace.getConfiguration = originalGetConfiguration;
      apiKeyCache.set = originalSet;
    }
  });

  test('should handle VSCode configuration access failures', () => {
    // Initialize the handler
    configChangeHandler.initialize();

    // Mock configuration change event
    const mockEvent: vscode.ConfigurationChangeEvent = {
      affectsConfiguration: (section: string) => section === 'DebugBuddy.apiKey'
    };

    // Mock the workspace configuration to throw error
    const originalGetConfiguration = vscode.workspace.getConfiguration;
    vscode.workspace.getConfiguration = (section?: string) => {
      throw new Error('VSCode configuration access failed');
    };

    try {
      // Should not throw despite VSCode configuration failure
      assert.doesNotThrow(() => {
        configChangeHandler.onConfigurationChanged(mockEvent);
      });

      // Cache should remain uninitialized
      assert.strictEqual(apiKeyCache.isInitialized(), false);

    } finally {
      // Restore original function
      vscode.workspace.getConfiguration = originalGetConfiguration;
    }
  });

  test('should handle initialization failures gracefully', () => {
    // Since we can't mock the read-only onDidChangeConfiguration property,
    // we test that the initialize method handles errors gracefully by
    // verifying it doesn't throw when called multiple times
    
    // Should not throw on first initialization
    assert.doesNotThrow(() => {
      configChangeHandler.initialize();
    });

    // Should not throw on subsequent initializations
    assert.doesNotThrow(() => {
      configChangeHandler.initialize();
    });
  });

  test('should handle prompt configuration changes', () => {
    // Initialize the handler
    configChangeHandler.initialize();

    // Mock configuration change event for prompt settings
    const mockEvent: vscode.ConfigurationChangeEvent = {
      affectsConfiguration: (section: string) => section === 'DebugBuddy.prompts'
    };

    // Mock the workspace configuration
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

    // Should not throw when handling prompt configuration changes
    assert.doesNotThrow(() => {
      configChangeHandler.onConfigurationChanged(mockEvent);
    });

    // Restore original function
    vscode.workspace.getConfiguration = originalGetConfiguration;
  });

  test('should register and notify prompt configuration listeners', () => {
    let listenerCalled = false;
    let receivedSettings: any = null;

    // Register a listener
    const disposable = configChangeHandler.onPromptConfigurationChange((settings) => {
      listenerCalled = true;
      receivedSettings = settings;
    });

    // Initialize the handler
    configChangeHandler.initialize();

    // Mock configuration change event for prompt settings
    const mockEvent: vscode.ConfigurationChangeEvent = {
      affectsConfiguration: (section: string) => section === 'DebugBuddy.prompts'
    };

    // Mock the workspace configuration
    const originalGetConfiguration = vscode.workspace.getConfiguration;
    vscode.workspace.getConfiguration = (section?: string) => ({
      get: (key: string, defaultValue?: any) => {
        const mockValues: Record<string, any> = {
          'prompts.experienceLevel': 'advanced',
          'prompts.maxSuggestions': 10,
          'prompts.includeExplanations': false,
          'prompts.customFocusAreas': ['performance'],
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
      update: () => Promise.resolve()
    } as any);

    // Trigger configuration change
    configChangeHandler.onConfigurationChanged(mockEvent);

    assert.strictEqual(listenerCalled, true);
    assert.ok(receivedSettings !== null);
    assert.strictEqual(receivedSettings.experienceLevel, 'advanced');
    assert.strictEqual(receivedSettings.maxSuggestions, 10);
    assert.strictEqual(receivedSettings.includeExplanations, false);

    // Clean up
    disposable.dispose();
    vscode.workspace.getConfiguration = originalGetConfiguration;
  });

  test('should handle errors in prompt configuration listeners', () => {
    // Register a listener that throws an error
    const disposable = configChangeHandler.onPromptConfigurationChange(() => {
      throw new Error('Test listener error');
    });

    // Initialize the handler
    configChangeHandler.initialize();

    // Mock configuration change event
    const mockEvent: vscode.ConfigurationChangeEvent = {
      affectsConfiguration: (section: string) => section === 'DebugBuddy.prompts'
    };

    // Mock the workspace configuration
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

    // Should not throw even when listener throws
    assert.doesNotThrow(() => {
      configChangeHandler.onConfigurationChanged(mockEvent);
    });

    // Clean up
    disposable.dispose();
    vscode.workspace.getConfiguration = originalGetConfiguration;
  });
});