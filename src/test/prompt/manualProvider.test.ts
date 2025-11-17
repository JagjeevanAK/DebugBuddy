import * as assert from 'assert';
import { ProcessedPrompt } from '../../prompt/types';

suite('Prompt Processing Tests', () => {
    const testProcessedPrompt: ProcessedPrompt = {
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

    const testStringPrompt = 'Simple string prompt for testing';

    suite('Prompt Structure Validation', () => {
        test('should have valid ProcessedPrompt structure', () => {
            const content = testProcessedPrompt.content as any;
            
            assert.strictEqual(content.task, 'code_review');
            assert.ok(content.instructions);
            assert.strictEqual(content.instructions.length > 0, true);
            assert.ok(content.context);
            assert.deepStrictEqual(Object.keys(content.context).sort(), ['code', 'errorMessage', 'filePath', 'language', 'lineNumber'].sort());
            assert.strictEqual(content.output_format.structure, 'categorized_list');
            assert.deepStrictEqual(testProcessedPrompt.variables_used, ['language', 'code', 'filePath']);
        });

        test('should handle string prompts', () => {
            assert.strictEqual(typeof testStringPrompt, 'string');
            assert.strictEqual(testStringPrompt.length, 32);
        });
    });

    suite('Prompt Serialization', () => {
        test('should serialize and deserialize ProcessedPrompt correctly', () => {
            const serializedProcessed = JSON.stringify(testProcessedPrompt, null, 2);
            
            assert.ok(serializedProcessed.length > 0);
            assert.ok(serializedProcessed.includes('code_review'));
            assert.ok(serializedProcessed.includes('Review the following'));
            
            const parsed = JSON.parse(serializedProcessed);
            assert.strictEqual(parsed.content.task, 'code_review');
        });
    });

    suite('Prompt Processing Logic', () => {
        function processPrompt(prompt: any): string {
            let promptText: string;
            
            if (typeof prompt === 'string') {
                promptText = prompt;
            } else if (typeof prompt === 'object' && prompt !== null) {
                if ('content' in prompt && 'metadata' in prompt) {
                    const content = prompt.content as any;
                    if (content.instructions) {
                        promptText = content.instructions;
                        
                        if (content.context && Object.keys(content.context).length > 0) {
                            promptText += '\n\nContext:\n' + JSON.stringify(content.context, null, 2);
                        }
                        
                        if (content.task) {
                            promptText = `Task: ${content.task}\n\n${promptText}`;
                        }
                        
                        if (content.output_format) {
                            promptText += '\n\nOutput Format:\n' + JSON.stringify(content.output_format, null, 2);
                        }
                    } else {
                        promptText = JSON.stringify(content, null, 2);
                    }
                } else {
                    promptText = JSON.stringify(prompt);
                }
            } else {
                promptText = String(prompt);
            }
            
            return promptText;
        }

        test('should process ProcessedPrompt correctly', () => {
            const processedText = processPrompt(testProcessedPrompt);
            
            assert.ok(processedText.includes('Task: code_review'));
            assert.ok(processedText.includes('Review the following'));
            assert.ok(processedText.includes('Context:'));
            assert.ok(processedText.includes('Output Format:'));
            assert.ok(processedText.length > 0);
        });

        test('should process string prompts unchanged', () => {
            const stringText = processPrompt(testStringPrompt);
            
            assert.strictEqual(stringText, testStringPrompt);
        });
    });

    suite('Provider Response Structure', () => {
        test('should validate response structure', () => {
            const mockResponse = {
                text: 'Mock LLM response',
                metadata: testProcessedPrompt.metadata,
                promptType: 'code_review'
            };
            
            assert.strictEqual(typeof mockResponse.text, 'string');
            assert.ok(mockResponse.metadata);
            assert.strictEqual(typeof mockResponse.promptType, 'string');
            assert.ok(Array.isArray(mockResponse.metadata?.supported_languages));
            assert.strictEqual(mockResponse.promptType, 'code_review');
        });
    });
});
