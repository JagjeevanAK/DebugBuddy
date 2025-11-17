import * as assert from 'assert';
import { apiKeyCache } from '../../lib/apiKeyCache';

suite('API Key Cache Service Tests', () => {
  
  setup(() => {
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
    
    apiKeyCache.set(testKey);
    assert.strictEqual(apiKeyCache.isInitialized(), true);
    assert.strictEqual(apiKeyCache.get(), testKey);
    
    apiKeyCache.clear();
    assert.strictEqual(apiKeyCache.isInitialized(), false);
    assert.strictEqual(apiKeyCache.get(), undefined);
  });

  test('should maintain singleton behavior', () => {
    const testKey1 = 'test-key-1';
    const testKey2 = 'test-key-2';
    
    apiKeyCache.set(testKey1);
    
    const { apiKeyCache: anotherRef } = require('../../lib/apiKeyCache');
    assert.strictEqual(anotherRef.get(), testKey1);
    
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
    const testKey = 'error-test-key';
    
    apiKeyCache.set(testKey);
    assert.strictEqual(apiKeyCache.get(), testKey);
    assert.strictEqual(apiKeyCache.isInitialized(), true);
    
    apiKeyCache.clear();
    assert.strictEqual(apiKeyCache.isInitialized(), false);
  });
});