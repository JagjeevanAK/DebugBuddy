import MarkdownIt from 'markdown-it';

export class MarkdownRenderer {
  private md: MarkdownIt;

  constructor() {
    this.md = new MarkdownIt({
      html: true,
      linkify: true,
      typographer: true
    });
  }

  public renderMarkdown(content: string): string {
    if (!content?.trim()) {
      return '<p><em>No content to display</em></p>';
    }
    
    try {
      return this.md.render(content);
    } catch (error) {
      console.error('Markdown rendering error:', error);
      return `<p><strong>Rendering failed:</strong> ${this.escapeHtml((error as Error).message)}</p>`;
    }
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
