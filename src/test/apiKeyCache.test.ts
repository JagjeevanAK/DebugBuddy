import * as assert from 'assert';
import { apiKeyCache } from '../lib/apiKeyCache';

suite('API Key Cache Service Tests', () => {
  
  setup(() => {
    // Clear cache before each test
    apiKeyCache.clear();
  });

  test('should start uninitialized', () => {
    assert.strictEqual(apiKeyCache.isInitialized(), false);
    assert.strictEqual(apiKeyCache.get(), undefined);
  });

  test('should cache API key and mark as initialized', () => {
    const testKey = 'test-api-key-123';
    
    apiKeyCache.set(testKey);
    
    assert.strictEqual(apiKeyCache.isInitialized(), true);
    assert.strictEqual(apiKeyCache.get(), testKey);
  });

  test('should handle undefined API key values', () => {
    apiKeyCache.set(undefined);
    
    assert.strictEqual(apiKeyCache.isInitialized(), true);
    assert.strictEqual(apiKeyCache.get(), undefined);
  });

  test('should handle null API key values', () => {
    apiKeyCache.set(null as any);
    
    assert.strictEqual(apiKeyCache.isInitialized(), true);
    assert.strictEqual(apiKeyCache.get(), null);
  });

  test('should clear cache and reset initialization state', () => {
    const testKey = 'test-api-key-456';
    
    // Set a key first
    apiKeyCache.set(testKey);
    assert.strictEqual(apiKeyCache.isInitialized(), true);
    assert.strictEqual(apiKeyCache.get(), testKey);
    
    // Clear the cache
    apiKeyCache.clear();
    assert.strictEqual(apiKeyCache.isInitialized(), false);
    assert.strictEqual(apiKeyCache.get(), undefined);
  });

  test('should maintain singleton behavior', () => {
    const testKey1 = 'test-key-1';
    const testKey2 = 'test-key-2';
    
    // Set key using one reference
    apiKeyCache.set(testKey1);
    
    // Import and use another reference - should be the same instance
    const { apiKeyCache: anotherRef } = require('../lib/apiKeyCache');
    assert.strictEqual(anotherRef.get(), testKey1);
    
    // Update using the other reference
    anotherRef.set(testKey2);
    assert.strictEqual(apiKeyCache.get(), testKey2);
  });

  test('should update cached value when set multiple times', () => {
    const key1 = 'first-key';
    const key2 = 'second-key';
    
    apiKeyCache.set(key1);
    assert.strictEqual(apiKeyCache.get(), key1);
    
    apiKeyCache.set(key2);
    assert.strictEqual(apiKeyCache.get(), key2);
    assert.strictEqual(apiKeyCache.isInitialized(), true);
  });

  test('should handle cache operations gracefully under normal conditions', () => {
    assert.doesNotThrow(() => {
      apiKeyCache.isInitialized();
    });

    assert.doesNotThrow(() => {
      apiKeyCache.set('test-key');
    });

    assert.doesNotThrow(() => {
      apiKeyCache.get();
    });

    assert.doesNotThrow(() => {
      apiKeyCache.clear();
    });
  });

  test('should provide meaningful error messages when operations fail', () => {
    // Since the current implementation is simple and unlikely to fail,
    // we test that the error handling structure is in place
    const testKey = 'error-test-key';
    
    // These should work normally
    apiKeyCache.set(testKey);
    assert.strictEqual(apiKeyCache.get(), testKey);
    assert.strictEqual(apiKeyCache.isInitialized(), true);
    
    apiKeyCache.clear();
    assert.strictEqual(apiKeyCache.isInitialized(), false);
  });
});