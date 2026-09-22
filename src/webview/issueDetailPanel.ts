import * as vscode from 'vscode';
import { ApiClient } from '../api/client';
import { addIssueComment } from '../api/issueApi';
import { Issue, IssueComment } from '../api/types';

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export class IssueDetailPanel {
  private readonly panel: vscode.WebviewPanel;
  private readonly comments: IssueComment[] = [];

  constructor(
    private readonly client: ApiClient,
    private readonly owner: string,
    private readonly project: string,
    private readonly issue: Issue,
  ) {
    this.panel = vscode.window.createWebviewPanel(
      'yonaIssueDetail',
      `#${issue.number} ${issue.title}`,
      vscode.ViewColumn.One,
      { enableScripts: true },
    );
    this.panel.webview.onDidReceiveMessage((message) => this.handleMessage(message));
    this.render();
  }

  reveal(): void {
    this.panel.reveal();
  }

  onDidDispose(listener: () => void): vscode.Disposable {
    return this.panel.onDidDispose(listener);
  }

  get html(): string {
    return this.panel.webview.html;
  }

  async handleMessage(message: { type: string; contents?: string }): Promise<void> {
    if (message.type === 'addComment' && message.contents) {
      const comment = await addIssueComment(
        this.client,
        this.owner,
        this.project,
        this.issue.number,
        message.contents,
      );
      this.comments.push(comment);
      this.render();
    }
  }

  private render(): void {
    const commentsHtml = this.comments
      .map(
        (comment) =>
          `<li><strong>${escapeHtml(comment.authorName ?? comment.authorLoginId)}</strong>: ${escapeHtml(comment.contents)}</li>`,
      )
      .join('');

    this.panel.webview.html = `<!doctype html>
<html>
<body>
  <h2>#${this.issue.number} ${escapeHtml(this.issue.title)}</h2>
  <p>${escapeHtml(this.issue.body ?? '')}</p>
  <h3>코멘트</h3>
  <ul id="comments">${commentsHtml}</ul>
  <textarea id="commentInput"></textarea>
  <button id="submitButton">코멘트 작성</button>
  <script>
    const vscode = acquireVsCodeApi();
    document.getElementById('submitButton').addEventListener('click', () => {
      const input = document.getElementById('commentInput');
      vscode.postMessage({ type: 'addComment', contents: input.value });
      input.value = '';
    });
  </script>
</body>
</html>`;
  }
}
