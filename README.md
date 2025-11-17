# DebugBuddy

DebugBuddy is your AI mentor — it helps you understand and resolve errors by offering thoughtful suggestions, encouraging you to think instead of instantly solving everything for you.

## Features

### **Hover Error Explanations**

Hover over any error or warning in your code to get instant AI-powered explanations and suggestions. No need to search for solutions - DebugBuddy provides context-aware help right where you need it.

### **AI-Powered Code Analysis**

Get comprehensive code analysis with multiple specialized features:

- **Code Review** - Comprehensive analysis for best practices and potential issues
- **Performance Analysis** - Identify bottlenecks and optimization opportunities
- **Refactoring Suggestions** - Improve code maintainability and structure
- **Security Analysis** - Find vulnerabilities and security issues

Access all features through:
- Right-click context menu → "Analyze Code with DebugBuddy..."
- Command Palette → Individual analysis commands
- Context menu → Direct access to each analysis type

### Multi-Provider AI Support

Choose your preferred AI provider and model based on your needs:

- **OpenAI** - Choose from GPT-4o, GPT-4o-mini, or other models
- **Anthropic** - Select Claude 3.5 Sonnet, Claude 3 Opus, or other variants
- **Google Gemini** - Pick Gemini 2.0 Flash, Gemini 1.5 Pro, or other models
- **Groq** - Configure Llama 3.3 70B, Mixtral 8x7B, or other high-speed models
- **xAI** - Use Grok Beta or other available models
- **OpenRouter** - Access 200+ models from multiple providers through a single API

## How to Use

### First-Time Setup

1. Install DebugBuddy extension
2. Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
3. Type "Set API Key for DebugBuddy"
4. Select your AI provider (OpenAI, Anthropic, Gemini, Groq, xAI, or OpenRouter)
5. Paste your API key
6. Choose your preferred model (e.g., gpt-4o, claude-3-5-sonnet-latest, gemini-2.0-flash-exp)
7. Start coding!

### Get Error Help

1. Hover over any red squiggly line (error) in your code
2. DebugBuddy automatically shows AI explanation
3. Read the suggestion and apply the fix

### Review Your Code

1. Open any code file
2. Right-click in editor: "Analyze Code with DebugBuddy..."
3. Choose your analysis type:
   - **Code Review** - Best practices and code quality
   - **Performance Analysis** - Speed and efficiency improvements
   - **Refactoring Suggestions** - Code structure improvements
   - **Security Analysis** - Vulnerability detection
4. View the comprehensive analysis in the webview panel

### Quick Access Commands

All features available via Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`):
- "Analyze Code with DebugBuddy..." - Choose analysis type
- "Review Current File with DebugBuddy" - Code review
- "Analyze Performance with DebugBuddy" - Performance analysis
- "Suggest Refactoring with DebugBuddy" - Refactoring suggestions
- "Analyze Security with DebugBuddy" - Security audit

### Manage API Keys

- **View Key**: Press `Cmd+Shift+P` and select "Show API Key of DebugBuddy"
- **Change Key**: Press `Cmd+Shift+P` and select "Set API Key for DebugBuddy"
- **Delete Key**: Press `Cmd+Shift+P` and select "Delete API Key of DebugBuddy"

## Commands

- `DebugBuddy: Set API Key` - Configure your AI provider API key
- `DebugBuddy: Review Current File` - Get AI analysis of the current file
- `DebugBuddy: Show Webview` - Open the DebugBuddy response panel
- `DebugBuddy: Show API Key` - Display your current API key
- `DebugBuddy: Delete API Key` - Remove stored API key

## Requirements

- VS Code 1.102.0 or higher
- API key from one of the supported AI providers (OpenAI, Anthropic, Google, xAI)

## Configuration

Configure DebugBuddy behavior in VS Code settings:

- `debugBuddy.webview.autoShow` - Automatically show webview for responses
- `debugBuddy.webview.retainContext` - Keep webview state when hidden
- `debugBuddy.webview.enableSyntaxHighlighting` - Enable code syntax highlighting

---

**Enjoy coding with AI assistance!**
