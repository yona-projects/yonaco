import * as vscode from 'vscode';
import { ApiClient } from '../api/client';
import { addIssueComment, closeIssue, reopenIssue } from '../api/issueApi';
import { Issue, IssueComment } from '../api/types';

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export class IssueDetailPanel {
  private readonly panel: vscode.WebviewPanel;
  private readonly comments: IssueComment[] = [];
  private issue: Issue;

  constructor(
    private readonly client: ApiClient,
    private readonly owner: string,
    private readonly project: string,
    issue: Issue,
    private readonly onIssueChanged?: () => void,
  ) {
    this.issue = issue;
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

  dispose(): void {
    this.panel.dispose();
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
      return;
    }

    if (message.type === 'closeIssue') {
      this.issue = await closeIssue(this.client, this.owner, this.project, this.issue.number);
      this.panel.title = `#${this.issue.number} ${this.issue.title}`;
      this.render();
      this.onIssueChanged?.();
      return;
    }

    if (message.type === 'reopenIssue') {
      this.issue = await reopenIssue(this.client, this.owner, this.project, this.issue.number);
      this.panel.title = `#${this.issue.number} ${this.issue.title}`;
      this.render();
      this.onIssueChanged?.();
    }
  }

  private render(): void {
    const commentsHtml = this.comments
      .map(
        (comment) =>
          `<li><strong>${escapeHtml(comment.authorName ?? comment.authorLoginId)}</strong>: ${escapeHtml(comment.contents)}</li>`,
      )
      .join('');

    const isOpen = this.issue.state === 'OPEN';
    const stateButtonHtml = isOpen
      ? '<button id="closeButton">완료</button>'
      : '<button id="reopenButton">재오픈</button>';

    this.panel.webview.html = `<!doctype html>
<html>
<body>
  <h2>#${this.issue.number} ${escapeHtml(this.issue.title)}</h2>
  <p>상태: ${escapeHtml(this.issue.state)}</p>
  <p>${escapeHtml(this.issue.body ?? '')}</p>
  ${stateButtonHtml}
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
    const closeButton = document.getElementById('closeButton');
    if (closeButton) {
      closeButton.addEventListener('click', () => vscode.postMessage({ type: 'closeIssue' }));
    }
    const reopenButton = document.getElementById('reopenButton');
    if (reopenButton) {
      reopenButton.addEventListener('click', () => vscode.postMessage({ type: 'reopenIssue' }));
    }
  </script>
</body>
</html>`;
  }
}
