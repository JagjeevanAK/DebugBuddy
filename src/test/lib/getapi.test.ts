import * as assert from 'assert';
import * as vscode from 'vscode';
import { getApiKey } from '../../lib/config';
import { apiKeyCache } from '../../lib/apiKeyCache';

suite('getApiKey Function Tests', () => {

    setup(() => {
        apiKeyCache.clear();
    });

    test('should query VSCode settings on first call and cache result', async () => {
        const mockApiKey = 'test-api-key-123';

        const mockConfig = {
            get: (key: string) => {
                if (key === 'apiKey') {
                    return mockApiKey;
                }
                return undefined;
            }
        };

        const originalGetConfiguration = vscode.workspace.getConfiguration;
        vscode.workspace.getConfiguration = (section?: string) => {
            if (section === 'DebugBuddy') {
                return mockConfig as any;
            }
            return originalGetConfiguration(section);
        };

        try {
            assert.strictEqual(apiKeyCache.isInitialized(), false);
            const result1 = getApiKey();
            assert.strictEqual(result1, mockApiKey);
            assert.strictEqual(apiKeyCache.isInitialized(), true);
            assert.strictEqual(apiKeyCache.get(), mockApiKey);

            const result2 = getApiKey();
            assert.strictEqual(result2, mockApiKey);

        } finally {
            vscode.workspace.getConfiguration = originalGetConfiguration;
        }
    });

    test('should return cached value on subsequent calls', () => {
        const testKey = 'cached-api-key';

        apiKeyCache.set(testKey);

        const result = getApiKey();
        assert.strictEqual(result, testKey);
    });

    test('should handle undefined API key from VSCode settings', async () => {
        const mockConfig = {
            get: (key: string) => undefined
        };

        const originalGetConfiguration = vscode.workspace.getConfiguration;
        vscode.workspace.getConfiguration = (section?: string) => {
            if (section === 'DebugBuddy') {
                return mockConfig as any;
            }
            return originalGetConfiguration(section);
        };

        try {
            const result = getApiKey();
            assert.strictEqual(result, undefined);
            assert.strictEqual(apiKeyCache.isInitialized(), true);
            assert.strictEqual(apiKeyCache.get(), undefined);

        } finally {
            vscode.workspace.getConfiguration = originalGetConfiguration;
        }
    });

    test('should maintain backward compatibility', async () => {
        const mockApiKey = 'backward-compatible-key';

        const mockConfig = {
            get: (key: string) => {
                if (key === 'apiKey') {
                    return mockApiKey;
                }
                return undefined;
            }
        };

        const originalGetConfiguration = vscode.workspace.getConfiguration;
        vscode.workspace.getConfiguration = (section?: string) => {
            if (section === 'DebugBuddy') {
                return mockConfig as any;
            }
            return originalGetConfiguration(section);
        };

        try {
            const result = getApiKey();
            assert.strictEqual(result, mockApiKey);

        } finally {
            vscode.workspace.getConfiguration = originalGetConfiguration;
        }
    });

    test('should fallback to direct VSCode query when cache fails', async () => {
        const mockApiKey = 'fallback-test-key';

        const mockConfig = {
            get: (key: string) => {
                if (key === 'apiKey') {
                    return mockApiKey;
                }
                return undefined;
            }
        };

        const originalGetConfiguration = vscode.workspace.getConfiguration;
        vscode.workspace.getConfiguration = (section?: string) => {
            if (section === 'DebugBuddy') {
                return mockConfig as any;
            }
            return originalGetConfiguration(section);
        };

        const originalGet = apiKeyCache.get;
        apiKeyCache.get = () => {
            throw new Error('Cache access failed');
        };

        try {
            apiKeyCache.set('some-key');
            
            const result = getApiKey();
            assert.strictEqual(result, mockApiKey);

        } finally {
            vscode.workspace.getConfiguration = originalGetConfiguration;
            apiKeyCache.get = originalGet;
            apiKeyCache.clear();
        }
    });

    test('should handle cache set failures gracefully', async () => {
        const mockApiKey = 'cache-set-fail-key';

        const mockConfig = {
            get: (key: string) => {
                if (key === 'apiKey') {
                    return mockApiKey;
                }
                return undefined;
            }
        };

        const originalGetConfiguration = vscode.workspace.getConfiguration;
        vscode.workspace.getConfiguration = (section?: string) => {
            if (section === 'DebugBuddy') {
                return mockConfig as any;
            }
            return originalGetConfiguration(section);
        };

        const originalSet = apiKeyCache.set;
        apiKeyCache.set = () => {
            throw new Error('Cache set failed');
        };

        try {
            const result = getApiKey();
            assert.strictEqual(result, mockApiKey);

        } finally {
            vscode.workspace.getConfiguration = originalGetConfiguration;
            apiKeyCache.set = originalSet;
        }
    });

    test('should handle VSCode configuration errors with fallback', async () => {
        const originalGetConfiguration = vscode.workspace.getConfiguration;
        let callCount = 0;
        
        vscode.workspace.getConfiguration = (section?: string) => {
            callCount++;
            if (callCount === 1) {
                throw new Error('VSCode configuration error');
            } else {
                return {
                    get: (key: string) => {
                        if (key === 'apiKey') {
                            return 'fallback-key';
                        }
                        return undefined;
                    }
                } as any;
            }
        };

        try {
            const result = getApiKey();
            assert.strictEqual(result, 'fallback-key');
            assert.strictEqual(callCount, 2);

        } finally {
            vscode.workspace.getConfiguration = originalGetConfiguration;
        }
    });

    test('should return undefined when all fallbacks fail', async () => {
        const originalGetConfiguration = vscode.workspace.getConfiguration;
        vscode.workspace.getConfiguration = () => {
            throw new Error('All VSCode configuration calls fail');
        };

        try {
            const result = getApiKey();
            assert.strictEqual(result, undefined);

        } finally {
            vscode.workspace.getConfiguration = originalGetConfiguration;
        }
    });
});