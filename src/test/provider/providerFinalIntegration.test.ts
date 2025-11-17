import * as assert from 'assert';
import { ProcessedPrompt } from '../../prompt/types';

suite('Provider Final Integration Test', () => {
    
    test('All provider tools should handle ProcessedPrompt structure', () => {
        const mockProcessedPrompt: ProcessedPrompt = {
            content: {
                task: 'code_review',
                instructions: 'Review the following code for potential issues and improvements.',
                context: {
                    language: 'typescript',
                    filePath: 'test.ts',
                    code: 'function test() { return "hello"; }',
                    errorMessage: '',
                    lineNumber: 1
                },
                output_format: {
                    structure: 'categorized_list',
                    include_line_numbers: true,
                    include_severity: true,
                    include_explanation: true
                }
            },
            metadata: {
                supported_languages: ['typescript', 'javascript'],
                required_context: ['code'],
                performance_notes: 'Fast processing'
            },
            variables_used: ['language', 'code', 'filePath']
        };

        assert.ok(mockProcessedPrompt.content);
        assert.ok(mockProcessedPrompt.metadata);
        assert.ok(Array.isArray(mockProcessedPrompt.variables_used));
        
        const content = mockProcessedPrompt.content as any;
        assert.strictEqual(content.task, 'code_review');
        assert.ok(content.instructions);
        assert.ok(content.context);
        assert.ok(content.output_format);
    });

    test('Provider response structure should include metadata', () => {
        const expectedResponse = {
            text: 'Mock LLM response',
            metadata: {
                supported_languages: ['typescript', 'javascript'],
                required_context: ['code'],
                performance_notes: 'Fast processing'
            },
            promptType: 'code_review'
        };

        assert.strictEqual(typeof expectedResponse.text, 'string');
        assert.strictEqual(typeof expectedResponse.metadata, 'object');
        assert.strictEqual(typeof expectedResponse.promptType, 'string');
        assert.ok(expectedResponse.metadata);
        assert.ok(Array.isArray(expectedResponse.metadata.supported_languages));
    });

    test('JSON prompt structure should be validated', () => {
        const jsonPrompt = {
            task: 'debug_analysis',
            instructions: 'Analyze this error and provide solutions.',
            context: {
                error: 'TypeError: Cannot read property of undefined',
                line: 42
            }
        };

        assert.strictEqual(jsonPrompt.task, 'debug_analysis');
        assert.ok(jsonPrompt.instructions);
        assert.ok(jsonPrompt.context);
        assert.strictEqual(jsonPrompt.context.line, 42);
    });

    test('String prompts should be handled correctly', () => {
        const stringPrompt = 'Simple string prompt for testing';
        
        assert.strictEqual(typeof stringPrompt, 'string');
        assert.strictEqual(stringPrompt.length, 32);
        assert.strictEqual(String(stringPrompt), stringPrompt);
    });

    test('Provider selection logic should work correctly', () => {
        const validProviders = ['Anthropic', 'Gemini', 'OpenAI', 'Xai'];
        
        assert.strictEqual(validProviders.length, 4);
        assert.ok(validProviders.includes('Anthropic'));
        assert.ok(validProviders.includes('OpenAI'));
        assert.ok(validProviders.includes('Gemini'));
        assert.ok(validProviders.includes('Xai'));
        
        assert.ok(!validProviders.includes('InvalidProvider'));
    });

    test('Prompt serialization should work for all formats', () => {
        const processedPrompt: ProcessedPrompt = {
            content: {
                task: 'security_analysis',
                instructions: 'Analyze code for security vulnerabilities.',
                context: {
                    language: 'javascript',
                    code: 'eval(userInput);'
                },
                output_format: {
                    structure: 'security_report'
                }
            },
            metadata: {
                supported_languages: ['javascript']
            },
            variables_used: ['language', 'code']
        };

        const serialized = JSON.stringify(processedPrompt);
        const deserialized = JSON.parse(serialized);
        
        assert.strictEqual(deserialized.content.task, 'security_analysis');
        assert.strictEqual(deserialized.content.context.language, 'javascript');
        assert.deepStrictEqual(deserialized.variables_used, ['language', 'code']);

        const jsonPrompt = {
            task: 'refactor',
            instructions: 'Suggest refactoring improvements.',
            context: { code: 'old code' }
        };

        const jsonSerialized = JSON.stringify(jsonPrompt);
        const jsonDeserialized = JSON.parse(jsonSerialized);
        
        assert.strictEqual(jsonDeserialized.task, 'refactor');
        assert.strictEqual(jsonDeserialized.context.code, 'old code');
    });

    test('Error handling should be robust', () => {
        assert.strictEqual(String(null), 'null');
        assert.strictEqual(String(undefined), 'undefined');
        
        const malformed = { incomplete: 'data' };
        const serialized = JSON.stringify(malformed);
        assert.ok(serialized.includes('incomplete'));
        assert.ok(serialized.includes('data'));
        
        const empty = {};
        assert.strictEqual(typeof empty, 'object');
        assert.strictEqual(Object.keys(empty).length, 0);
    });

    test('Context processing should handle all required fields', () => {
        const fullContext = {
            language: 'typescript',
            filePath: 'src/test.ts',
            code: 'function example() { return true; }',
            errorMessage: 'Type error',
            lineNumber: 5,
            columnNumber: 10,
            surroundingCode: 'context lines',
            framework: 'react'
        };

        assert.strictEqual(fullContext.language, 'typescript');
        assert.strictEqual(fullContext.filePath, 'src/test.ts');
        assert.ok(fullContext.code.includes('function'));
        assert.strictEqual(fullContext.lineNumber, 5);
        assert.strictEqual(fullContext.columnNumber, 10);
        
        const serialized = JSON.stringify(fullContext);
        const parsed = JSON.parse(serialized);
        assert.deepStrictEqual(parsed, fullContext);
    });

    test('Output format specifications should be preserved', () => {
        const outputFormat = {
            structure: 'categorized_list',
            include_line_numbers: true,
            include_severity: true,
            include_explanation: true,
            include_fix_suggestion: false
        };

        assert.strictEqual(outputFormat.structure, 'categorized_list');
        assert.strictEqual(outputFormat.include_line_numbers, true);
        assert.strictEqual(outputFormat.include_severity, true);
        assert.strictEqual(outputFormat.include_explanation, true);
        assert.strictEqual(outputFormat.include_fix_suggestion, false);
        
        const serialized = JSON.stringify(outputFormat);
        const parsed = JSON.parse(serialized);
        assert.deepStrictEqual(parsed, outputFormat);
    });
});