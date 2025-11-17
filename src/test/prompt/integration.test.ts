import * as assert from 'assert';
import { PromptManager } from '../../prompt/PromptManager';
import { UserAction, CodeContext } from '../../prompt/types';

suite('Prompt System Integration', () => {
    test('should process request with valid context', async () => {
        const manager = PromptManager.getInstance();
        await manager.initialize();

        const context: CodeContext = {
            selectedText: 'const x = 1;',
            fullText: 'const x = 1;',
            filePath: 'test.ts',
            language: 'typescript'
        };

        const result = await manager.processRequest(UserAction.CODE_REVIEW, context);
        assert.ok(result);
        assert.ok(result.content);
        assert.ok(result.metadata);
    });

    test('should handle multiple actions', async () => {
        const manager = PromptManager.getInstance();
        await manager.initialize();

        const context: CodeContext = {
            selectedText: 'function test() { }',
            fullText: 'function test() { }',
            filePath: 'test.js',
            language: 'javascript'
        };

        const actions = [
            UserAction.CODE_REVIEW,
            UserAction.REFACTOR,
            UserAction.SECURITY_ANALYSIS
        ];

        for (const action of actions) {
            const result = await manager.processRequest(action, context);
            assert.ok(result);
            assert.strictEqual(result.metadata.action, action);
        }
    });

    test('should get stats and available prompts', async () => {
        const manager = PromptManager.getInstance();
        await manager.initialize();

        const stats = manager.getStats();
        assert.ok(stats.initialized);
        assert.ok(stats.totalPrompts > 0);

        const prompts = manager.getAvailablePromptTypes();
        assert.ok(Array.isArray(prompts));
        assert.ok(prompts.length > 0);
    });
});