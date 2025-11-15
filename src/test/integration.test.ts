/**
 * Integration tests for prompt validation and error handling
 */

import * as assert from 'assert';
import { PromptValidator } from '../prompt/PromptValidator';
import { ErrorHandler } from '../prompt/ErrorHandler';
import { PromptError, PromptCategory } from '../prompt/types';

suite('Prompt System Integration', () => {
    test('should integrate validation with error handling', () => {
        const validator = new PromptValidator();
        const errorHandler = new ErrorHandler(false); // Disable console logging

        const invalidPrompt = {
            id: 'test',
            // Missing required fields
        } as any;

        const validation = validator.validatePrompt(invalidPrompt);
        assert.strictEqual(validation.isValid, false);
        assert.ok(validation.errors.length > 0);

        const strategy = errorHandler.handleError(PromptError.VALIDATION_ERROR, {
            promptId: 'test',
            errors: validation.errors
        });

        assert.strictEqual(strategy.useSimplePrompt, false);
        assert.ok(strategy.errorMessage);
    });

    test('should validate complete prompt successfully', () => {
        const validator = new PromptValidator();

        const validPrompt = {
            id: 'test-prompt',
            name: 'Test Prompt',
            description: 'A test prompt',
            category: PromptCategory.CODE_REVIEW,
            version: '1.0.0',
            schema_version: '1.0',
            template: {
                task: 'Review code',
                instructions: 'Analyze the code for issues',
                context: { focus: 'quality' },
                output_format: { structure: 'list' },
                variables: ['code']
            },
            config: {
                configurable_fields: ['focus'],
                default_values: { focus: 'quality' },
                validation_rules: {}
            }
        };

        const validation = validator.validatePrompt(validPrompt);
        assert.strictEqual(validation.isValid, true);
        assert.strictEqual(validation.errors.length, 0);
    });

    test('should handle error statistics correctly', () => {
        const errorHandler = new ErrorHandler(false);

        // Log some errors
        errorHandler.logError(PromptError.TEMPLATE_PARSE_ERROR, 'Test error 1', {});
        errorHandler.logError(PromptError.TEMPLATE_PARSE_ERROR, 'Test error 2', {});
        errorHandler.logError(PromptError.VALIDATION_ERROR, 'Test error 3', {});

        const stats = errorHandler.getErrorStats();
        assert.strictEqual(stats[PromptError.TEMPLATE_PARSE_ERROR].count, 2);
        assert.strictEqual(stats[PromptError.VALIDATION_ERROR].count, 1);
        assert.strictEqual(stats[PromptError.CONFIGURATION_ERROR].count, 0);

        assert.strictEqual(errorHandler.isErrorFrequent(PromptError.TEMPLATE_PARSE_ERROR, 2), true);
        assert.strictEqual(errorHandler.isErrorFrequent(PromptError.VALIDATION_ERROR, 2), false);
    });

    test('should validate template variable references', () => {
        const validator = new PromptValidator();

        const templateWithVariableIssues = {
            task: 'Review ${code} in ${language}',
            instructions: 'Focus on ${undeclared_var}',
            context: { setting: 'some value' }, // removed unused_var usage
            output_format: { structure: 'list' },
            variables: ['code', 'language', 'unused_var'] // missing undeclared_var, unused unused_var
        };

        const validation = validator.validateTemplate(templateWithVariableIssues);
        assert.strictEqual(validation.isValid, true); // Should be valid despite warnings
        assert.ok(validation.warnings.some(w => w.includes('undeclared_var')));
        assert.ok(validation.warnings.some(w => w.includes('unused_var')));
    });

    test('should handle graceful fallback strategies', () => {
        const errorHandler = new ErrorHandler(false);

        const templateError = errorHandler.handleError(PromptError.TEMPLATE_PARSE_ERROR, {});
        assert.strictEqual(templateError.useSimplePrompt, false);
        assert.strictEqual(templateError.fallbackPromptId, undefined);

        const variableError = errorHandler.handleError(PromptError.VARIABLE_SUBSTITUTION_ERROR, { promptId: 'test' });
        assert.strictEqual(variableError.useSimplePrompt, false);
        assert.strictEqual(variableError.fallbackPromptId, undefined);

        const notFoundError = errorHandler.handleError(PromptError.PROMPT_NOT_FOUND, {});
        assert.strictEqual(notFoundError.useSimplePrompt, false);
        assert.strictEqual(notFoundError.fallbackPromptId, undefined);
    });
});