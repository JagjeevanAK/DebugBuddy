
import * as vscode from 'vscode';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';

export interface ContentValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface IMarkdownRenderer {
  renderMarkdown(content: string): string;
  validateContent(content: string): ContentValidationResult;
  renderWithErrorHandling(content: string): { html: string; hasErrors: boolean; errors: string[] };
}

export class MarkdownRenderer implements IMarkdownRenderer {
  private md: MarkdownIt;

  constructor() {
    this.md = new MarkdownIt({
      html: true,
      linkify: true,
      typographer: true,
      highlight: () => '', // Disable highlighting completely
    });

    // Customize inline code rendering
    this.md.renderer.rules.code_inline = (tokens, idx) => {
      const token = tokens[idx];
      const content = this.md.utils.escapeHtml(token.content);
      return `<code class="inline">${content}</code>`;
    };

    // Customize fence rendering to include detected language
    this.md.renderer.rules.fence = (tokens, idx, options, env, renderer) => {
      const token = tokens[idx];
      const info = token.info ? this.md.utils.unescapeAll(token.info).trim() : '';
      let langName = '';
      
      if (info) {
        langName = info.split(/\s+/g)[0];
      } else {
        // Auto-detect language if not specified
        langName = this.detectLanguage(token.content);
      }
      
      // Don't use the highlight function - just escape the content
      const content = this.md.utils.escapeHtml(token.content);
      return `<pre><code class="language-${langName}">${content}</code></pre>\n`;
    };
  }

  public renderMarkdown(content: string): string {
    try {
      if (!this.validateBasicContent(content)) {
        return '<p><em>No content to display</em></p>';
      }
      
      // Auto-detect language for code blocks without language specification
      const processedContent = this.preprocessCodeBlocks(content);
      return this.md.render(processedContent);
    } catch (error) {
      console.error('DebugBuddy: Markdown rendering error:', error);
      return this.renderErrorContent(`Markdown rendering failed: ${(error as Error).message}`);
    }
  }

  public addSyntaxHighlighting(html: string): string {
    return html.replace(
      /<code class="language-(\w+)"([^>]*)>/g,
      '<code class="language-$1 highlighted"$2>'
    ).replace(
      /<code class="hljs ([^"]*)">/g,
      '<code class="hljs $1 highlighted">'
    );
  }

  public applyTheme(html: string): string {
    // Theme is handled by CSS, so return input unchanged
    return html;
  }

  public validateContent(content: string): ContentValidationResult {
    const result: ContentValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    if (!content || typeof content !== 'string') {
      result.isValid = false;
      result.errors.push('Content is null, undefined, or not a string');
      return result;
    }

    if (content.trim().length === 0) {
      result.isValid = false;
      result.errors.push('Content is empty or contains only whitespace');
      return result;
    }

    if (content.length > 1000000) { // 1MB limit
      result.warnings.push('Content is very large and may affect performance');
    }

    try {
      this.md.render(content);
    } catch (error) {
      result.isValid = false;
      result.errors.push(`Markdown parsing error: ${(error as Error).message}`);
    }

    return result;
  }

  public renderWithErrorHandling(content: string): { html: string; hasErrors: boolean; errors: string[] } {
    const validation = this.validateContent(content);
    
    if (!validation.isValid) {
      return {
        html: this.renderErrorContent(`Content validation failed: ${validation.errors.join(', ')}`),
        hasErrors: true,
        errors: validation.errors
      };
    }

    try {
      const html = this.md.render(content);
      return {
        html,
        hasErrors: false,
        errors: []
      };
    } catch (error) {
      const errorMessage = `Rendering failed: ${(error as Error).message}`;
      return {
        html: this.renderErrorContent(errorMessage),
        hasErrors: true,
        errors: [errorMessage]
      };
    }
  }

  private validateBasicContent(content: string): boolean {
    return !!(content && typeof content === 'string' && content.trim().length > 0);
  }

  private renderErrorContent(errorMessage: string): string {
    return `
      <div class="error-container" style="
        padding: 20px;
        background-color: var(--vscode-errorForeground, #f48771);
        color: var(--vscode-editor-background, #ffffff);
        border-radius: 4px;
        margin: 10px 0;
        border-left: 4px solid var(--vscode-errorForeground, #f48771);
      ">
        <h3 style="margin-top: 0; color: var(--vscode-editor-background, #ffffff);">
          Content Error
        </h3>
        <p style="margin-bottom: 0;">
          ${this.md.utils.escapeHtml(errorMessage)}
        </p>
        <details style="margin-top: 10px;">
          <summary style="cursor: pointer; color: var(--vscode-editor-background, #ffffff);">
            Troubleshooting Tips
          </summary>
          <ul style="margin-top: 10px; color: var(--vscode-editor-background, #ffffff);">
            <li>Ensure the AI response contains valid content</li>
            <li>Check if the content is properly formatted markdown</li>
            <li>Try refreshing the webview or rerunning the command</li>
            <li>Check the VS Code output panel for detailed error logs</li>
          </ul>
        </details>
      </div>
    `;
  }

  private preprocessCodeBlocks(content: string): string {
    // Auto-detect language for code blocks without language specification
    return content.replace(/```\n([\s\S]*?)\n```/g, (match, code) => {
      const detectedLang = this.detectLanguage(code);
      return `\`\`\`${detectedLang}\n${code}\n\`\`\``;
    });
  }

  private detectLanguage(code: string): string {
    const trimmedCode = code.trim();
    
    // JavaScript detection
    if (/\b(function|const|let|var|console\.log|=>)\b/.test(trimmedCode)) {
      return 'javascript';
    }
    
    // TypeScript detection
    if (/\b(interface|type|string|number|boolean)\b/.test(trimmedCode) || 
        /:\s*(string|number|boolean)/.test(trimmedCode)) {
      return 'typescript';
    }
    
    // Python detection
    if (/\b(def|class|import|from|print)\b/.test(trimmedCode) || 
        /:\s*$/.test(trimmedCode.split('\n')[0])) {
      return 'python';
    }
    
    // Java detection
    if (/\b(public|private|class|static|void|System\.out\.println)\b/.test(trimmedCode) ||
        (/\bclass\b/.test(trimmedCode) && /\bpublic\b/.test(trimmedCode))) {
      return 'java';
    }
    
    // HTML detection
    if (/<\/?[a-z][\s\S]*>/i.test(trimmedCode) || /<!DOCTYPE/i.test(trimmedCode)) {
      return 'html';
    }
    
    // CSS detection
    if (/[.#][\w-]+\s*\{/.test(trimmedCode) || /[\w-]+:\s*[\w-]+;/.test(trimmedCode)) {
      return 'css';
    }
    
    // JSON detection
    if (/^\s*[\{\[]/.test(trimmedCode) && /[\}\]]\s*$/.test(trimmedCode)) {
      try {
        JSON.parse(trimmedCode);
        return 'json';
      } catch {
        // Not valid JSON
      }
    }
    
    // SQL detection
    if (/\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/i.test(trimmedCode)) {
      return 'sql';
    }
    
    // Bash detection
    if (/^#!/.test(trimmedCode) || /\b(echo|ls|cd|mkdir|rm|grep)\b/.test(trimmedCode)) {
      return 'bash';
    }
    
    // YAML detection
    if (/^[\w-]+:\s*/.test(trimmedCode) || /^\s*-\s+/.test(trimmedCode)) {
      return 'yaml';
    }
    
    // Default to text if no language detected
    return 'text';
  }

  private highlightCode(str: string, lang: string): string {
    // If no language specified, try to detect it
    if (!lang) {
      lang = this.detectLanguage(str);
    }
    
    // The addSyntaxHighlighting method will handle the actual highlighting
    return this.md.utils.escapeHtml(str);
  }
}
