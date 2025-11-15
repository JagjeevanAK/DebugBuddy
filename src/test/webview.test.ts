import * as assert from 'assert';
import * as vscode from 'vscode';
import { WebviewProvider } from '../webview/WebviewProvider';
import { WebviewManager } from '../webview/WebviewManager';

suite('Webview Infrastructure Tests', () => {
    let mockContext: vscode.ExtensionContext;

    setup(() => {
        // Create a minimal mock context for testing
        mockContext = {
            subscriptions: [],
            extensionUri: vscode.Uri.file('/test/path'),
        } as any;
    });

    test('WebviewProvider can be instantiated', () => {
        const provider = new WebviewProvider(mockContext);
        assert.ok(provider, 'WebviewProvider should be instantiated');
    });

    test('WebviewManager can be instantiated and initialized', () => {
        const manager = new WebviewManager();
        assert.ok(manager, 'WebviewManager should be instantiated');
        
        manager.initialize(mockContext);
        assert.ok(manager.isWebviewActive(), 'WebviewManager should be active after initialization');
    });

    test('WebviewManager throws error when not initialized', () => {
        const manager = new WebviewManager();
        
        assert.throws(() => {
            manager.displayResponse('test content', 'test.js');
        }, /WebviewManager not initialized/, 'Should throw error when not initialized');
    });

    test('HtmlTemplateSystem escapes HTML content correctly', () => {
        const { HtmlTemplateSystem } = require('../webview/HtmlTemplateSystem');
        const templateSystem = new HtmlTemplateSystem();
        
        const testCases = [
            { input: '<script>alert("xss")</script>', expected: '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;' },
            { input: 'Hello & World', expected: 'Hello &amp; World' },
            { input: "It's a test", expected: 'It&#39;s a test' }
        ];
        
        testCases.forEach(({ input, expected }) => {
            const result = templateSystem.escapeHtml(input);
            assert.strictEqual(result, expected, `HTML escaping failed for: ${input}`);
        });
        
        templateSystem.dispose();
    });
});