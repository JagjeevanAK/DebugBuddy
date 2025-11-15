import * as assert from 'assert';
import * as vscode from 'vscode';
import { WebviewManager } from '../webview/WebviewManager';
import { WebviewErrorLogger } from '../webview/WebviewErrorLogger';

suite('Webview Fallback Mechanism Tests', () => {
    let webviewManager: WebviewManager;
    let errorLogger: WebviewErrorLogger;

    setup(() => {
        webviewManager = new WebviewManager();
        errorLogger = WebviewErrorLogger.getInstance();
        errorLogger.clearErrors();
    });

    teardown(() => {
        webviewManager.dispose();
        errorLogger.clearErrors();
    });

    test('should fallback to terminal when webview creation fails', async () => {
        const content = 'Test content for fallback';
        const fileName = 'test.js';

        // This should trigger fallback since webview is not initialized
        webviewManager.displayResponseWithFallback(content, fileName);

        // Check that error was logged with fallback flag
        const stats = errorLogger.getErrorStats();
        assert.strictEqual(stats.fallbackUsageCount > 0, true, 'Fallback should have been used');
    });

    test('should handle empty content gracefully', () => {
        const emptyContent = '';
        const fileName = 'test.js';

        // Should not throw, should use fallback
        assert.doesNotThrow(() => {
            webviewManager.displayResponseWithFallback(emptyContent, fileName);
        });

        const stats = errorLogger.getErrorStats();
        assert.strictEqual(stats.fallbackUsageCount > 0, true, 'Fallback should have been used for empty content');
    });

    test('should detect critical webview errors', () => {
        const criticalError = new Error('Extension context is invalid or not available');
        
        for (let i = 0; i < 6; i++) {
            errorLogger.logError('createWebview', criticalError, true, {});
        }
        
        const healthStatus = errorLogger.getWebviewHealthStatus();
        assert.strictEqual(healthStatus.status !== 'healthy', true, 'Health status should not be healthy with critical errors');
        assert.strictEqual(healthStatus.recommendations.length > 0, true, 'Should provide recommendations for unhealthy status');
    });

    test('should provide error statistics', () => {
        // Log some test errors
        errorLogger.logError('test1', new Error('Test error 1'), false, {});
        errorLogger.logError('test2', new Error('Test error 2'), true, {});
        errorLogger.logError('test1', new Error('Test error 3'), false, {});

        const stats = errorLogger.getErrorStats();
        
        assert.strictEqual(stats.totalErrors, 3, 'Should track total errors');
        assert.strictEqual(stats.fallbackUsageCount, 1, 'Should track fallback usage');
        assert.strictEqual(stats.errorsByOperation['test1'], 2, 'Should group errors by operation');
        assert.strictEqual(stats.errorsByOperation['test2'], 1, 'Should group errors by operation');
    });

    test('should calculate fallback success rate', () => {
        // Log successful fallback
        errorLogger.logError('displayResponseWithFallback', new Error('Webview failed'), true, {});
        
        const stats = errorLogger.getErrorStats();
        assert.strictEqual(typeof stats.fallbackSuccessRate, 'number', 'Should provide fallback success rate');
        assert.strictEqual(stats.fallbackSuccessRate >= 0 && stats.fallbackSuccessRate <= 100, true, 'Success rate should be between 0-100');
    });

    test('should provide health recommendations', () => {
        for (let i = 0; i < 5; i++) {
            errorLogger.logError('createWebview', new Error('Failed to create webview panel'), true, {});
        }

        const healthStatus = errorLogger.getWebviewHealthStatus();
        assert.strictEqual(Array.isArray(healthStatus.recommendations), true, 'Should provide recommendations array');
        assert.strictEqual(healthStatus.recommendations.length > 0, true, 'Should provide recommendations for unhealthy status');
    });
});