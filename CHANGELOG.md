# Change Log

All notable changes to the "DebugBuddy" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.4.0] - 2025-11-17

### Added

- Performance Analysis command: Identify bottlenecks and optimization opportunities in your code
- Security Analysis command: Detect vulnerabilities and security issues
- Refactoring Suggestions command: Get AI-powered recommendations to improve code maintainability and structure
- Analyze with Options command: Quick pick menu to choose between different analysis types (Code Review, Performance, Refactoring, Security)
- Enhanced file analysis utility with support for multiple analysis types

### Improved

- Refactored model provider architecture with base provider class for better code organization
- Improved prompt registry system for better prompt management
- Enhanced test coverage with updated test files
- Code organization: Consolidated helper functions into utils directory
- Webview manager improvements for better response rendering

## [0.3.0] - 2025-01-15

### Added

- OpenRouter support: Access 200+ models through a single API endpoint
- Custom model selection: Users can now specify exact model names for each provider
  - OpenAI: Choose between gpt-4o, gpt-4o-mini, or any available model
  - Anthropic: Select claude-3-5-sonnet-latest, claude-3-opus-latest, etc.
  - Gemini: Pick gemini-2.0-flash-exp, gemini-1.5-pro, or other variants
  - Groq: Configure llama-3.3-70b-versatile, mixtral-8x7b-32768, etc.
  - xAI: Use grok-beta or other available models
  - OpenRouter: Access any model from their extensive catalog
- Enhanced configuration system: Model name validation during setup

### Changed

- API key setup now requires both provider selection and model name specification
- All provider tools now dynamically use configured custom models instead of hardcoded defaults

## [0.2.1] - 2025-11-15

### Changed

- Code cleanup: Removed unnecessary comments throughout the codebase
- Code cleanup: Removed emoji characters from code and UI for professional consistency
- Improved code readability and maintainability

## [0.2.0]

- Initial release with AI-powered error explanations
- Multi-provider AI support (OpenAI, Anthropic, Google Gemini, Groq, xAI)
- Hover error explanations
- Code review functionality
- Webview-based response display
- Prompt configuration system
