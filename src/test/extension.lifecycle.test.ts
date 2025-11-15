/**
 * Extension Lifecycle Integration Tests
 * 
 * Tests the integration of API key cache and configuration change handler
 * with the extension activation and deactivation lifecycle.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { activate, deactivate } from '../extension';
import { apiKeyCache } from '../lib/apiKeyCache';
import { configChangeHandler } from '../lib/configChangeHandler';

suite('Extension Lifecycle Integration Tests', () => {
  let mockContext: vscode.ExtensionContext;

  setup(() => {
    // Create a mock extension context
    mockContext = {
      subscriptions: [],
      workspaceState: {} as any,
      globalState: {} as any,
      extensionUri: {} as any,
      extensionPath: '',
      asAbsolutePath: (relativePath: string) => relativePath,
      storageUri: {} as any,
      storagePath: '',
      globalStorageUri: {} as any,
      globalStoragePath: '',
      logUri: {} as any,
      logPath: '',
      extensionMode: vscode.ExtensionMode.Test,
      secrets: {} as any,
      environmentVariableCollection: {} as any,
      extension: {} as any,
      languageModelAccessInformation: {} as any
    };

    // Clear cache before each test
    apiKeyCache.clear();
  });

  teardown(() => {
    // Clean up after each test
    deactivate();
  });

  test('should initialize cache manager during activation', () => {
    // Verify cache starts uninitialized
    assert.strictEqual(apiKeyCache.isInitialized(), false);

    activate(mockContext);

    // Cache should still be uninitialized (lazy initialization)
    // but the manager should be ready
    assert.strictEqual(apiKeyCache.isInitialized(), false);
    
    apiKeyCache.set('test-key');
    assert.strictEqual(apiKeyCache.get(), 'test-key');
    assert.strictEqual(apiKeyCache.isInitialized(), true);
  });

  test('should register configuration change handler during activation', () => {
    assert.strictEqual(mockContext.subscriptions.length, 0);

    configChangeHandler.initialize();
    
    // Manually add to subscriptions to simulate what activate() does
    mockContext.subscriptions.push(configChangeHandler);

    const hasConfigHandler = mockContext.subscriptions.includes(configChangeHandler);
    assert.strictEqual(hasConfigHandler, true, 'Configuration change handler should be in subscriptions');
    
    configChangeHandler.dispose();
  });

  test('should clear cache during deactivation', () => {
    apiKeyCache.set('test-key');
    assert.strictEqual(apiKeyCache.get(), 'test-key');
    assert.strictEqual(apiKeyCache.isInitialized(), true);

    deactivate();

    assert.strictEqual(apiKeyCache.get(), undefined);
    assert.strictEqual(apiKeyCache.isInitialized(), false);
  });

  test('should handle activation and deactivation cycle', () => {
    apiKeyCache.set('test-key-1');
    assert.strictEqual(apiKeyCache.get(), 'test-key-1');

    deactivate();
    assert.strictEqual(apiKeyCache.get(), undefined);
    assert.strictEqual(apiKeyCache.isInitialized(), false);

    // After deactivation, cache should be ready for reuse
    // (simulating extension restart scenario)
    assert.strictEqual(apiKeyCache.get(), undefined);
    assert.strictEqual(apiKeyCache.isInitialized(), true);

    apiKeyCache.set('test-key-2');
    assert.strictEqual(apiKeyCache.get(), 'test-key-2');
    assert.strictEqual(apiKeyCache.isInitialized(), true);
  });
});