import * as vscode from 'vscode';
import { ApiClient } from '../api/client';
import { addIssueComment, closeIssue, getIssueComments, reopenIssue } from '../api/issueApi';
import { Issue, IssueComment } from '../api/types';

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}

function formatDate(iso?: string): string {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleString();
}

export class IssueDetailPanel {
  private readonly panel: vscode.WebviewPanel;
  private readonly comments: IssueComment[] = [];
  private issue: Issue;
  private readonly loadingPromise: Promise<void>;

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
    this.loadingPromise = this.loadExistingComments();
  }

  // 통합테스트가 생성자에서 시작한 비동기 코멘트 이력 로딩이 끝난 뒤의 상태를 검증할 수 있게
  // 노출한다. 실제 사용자에게는 패널이 먼저 뜨고 잠시 후 코멘트가 채워지는 게 자연스러워
  // 생성자에서 이 Promise를 막고 기다리지 않는다.
  async waitUntilLoaded(): Promise<void> {
    return this.loadingPromise;
  }

  // 서버에 이제 이슈 코멘트 전체 이력을 조회하는 GET API가 생겨서(yona-projects/yona
  // a7ff97902), 예전처럼 "이번 세션에 직접 작성한 코멘트만" 보여주지 않고 과거 코멘트도
  // 함께 보여줄 수 있다. 조회 실패해도 코멘트 작성 자체는 막지 않도록 조용히 무시한다.
  private async loadExistingComments(): Promise<void> {
    try {
      const existing = await getIssueComments(this.client, this.owner, this.project, this.issue.number);
      this.comments.unshift(...existing);
      this.render();
    } catch {
      // 서버가 구버전이라 이 엔드포인트가 없거나 일시적으로 실패해도 패널 자체는 계속 써야 한다.
    }
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
    const nonce = getNonce();
    const isOpen = this.issue.state === 'OPEN';

    const commentsHtml = this.comments
      .map(
        (comment) => `
      <div class="comment">
        <div class="comment-header">
          <span class="comment-author">${escapeHtml(comment.authorName ?? comment.authorLoginId)}</span>
          <span class="comment-date">${escapeHtml(formatDate(comment.createdDate))}</span>
        </div>
        <div class="comment-body">${escapeHtml(comment.contents)}</div>
      </div>`,
      )
      .join('');

    const stateButtonHtml = isOpen
      ? '<button id="closeButton" class="secondary">완료</button>'
      : '<button id="reopenButton" class="secondary">재오픈</button>';

    this.panel.webview.html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
</head>
<body>
  <div class="issue-header">
    <span class="issue-number">#${this.issue.number}</span>
    <h1 class="issue-title">${escapeHtml(this.issue.title)}</h1>
    <span class="state-badge ${isOpen ? 'state-open' : 'state-closed'}">${escapeHtml(this.issue.state)}</span>
  </div>

  <div class="issue-body">${escapeHtml(this.issue.body ?? '')}</div>

  <div class="actions">${stateButtonHtml}</div>

  <h2 class="section-title">코멘트</h2>
  <div id="comments" class="comments">${commentsHtml}</div>

  <div class="comment-form">
    <textarea id="commentInput" placeholder="코멘트를 입력하세요..."></textarea>
    <button id="submitButton">코멘트 작성</button>
  </div>

  <style>
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      padding: 0 20px 24px;
    }

    .issue-header {
      display: flex;
      align-items: baseline;
      gap: 8px;
      flex-wrap: wrap;
      padding: 16px 0;
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    .issue-number {
      color: var(--vscode-descriptionForeground);
    }

    .issue-title {
      font-size: 1.3em;
      font-weight: 600;
      margin: 0;
      flex: 1;
    }

    .state-badge {
      font-size: 0.75em;
      font-weight: 600;
      letter-spacing: 0.02em;
      padding: 2px 8px;
      border-radius: 999px;
      color: var(--vscode-badge-foreground);
      background-color: var(--vscode-badge-background);
    }

    .state-open {
      background-color: var(--vscode-charts-green);
      color: var(--vscode-editor-background);
    }

    .state-closed {
      background-color: var(--vscode-charts-purple);
      color: var(--vscode-editor-background);
    }

    .issue-body {
      white-space: pre-wrap;
      line-height: 1.5;
      padding: 16px 0;
    }

    .actions {
      padding-bottom: 16px;
    }

    .section-title {
      font-size: 1em;
      font-weight: 600;
      color: var(--vscode-descriptionForeground);
      border-bottom: 1px solid var(--vscode-panel-border);
      padding-bottom: 8px;
    }

    .comments {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin: 16px 0;
    }

    .comment {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      overflow: hidden;
    }

    .comment-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding: 8px 12px;
      background-color: var(--vscode-editorWidget-background);
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    .comment-author {
      font-weight: 600;
    }

    .comment-date {
      font-size: 0.85em;
      color: var(--vscode-descriptionForeground);
    }

    .comment-body {
      padding: 12px;
      white-space: pre-wrap;
      line-height: 1.5;
    }

    .comment-form {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 16px;
    }

    textarea,
    button {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }

    textarea {
      min-height: 72px;
      padding: 8px;
      resize: vertical;
      color: var(--vscode-input-foreground);
      background-color: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
      border-radius: 4px;
    }

    textarea:focus {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: -1px;
    }

    button {
      align-self: flex-start;
      padding: 6px 14px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      color: var(--vscode-button-foreground);
      background-color: var(--vscode-button-background);
    }

    button:hover {
      background-color: var(--vscode-button-hoverBackground);
    }

    button.secondary {
      color: var(--vscode-button-secondaryForeground);
      background-color: var(--vscode-button-secondaryBackground);
    }

    button.secondary:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
    }
  </style>

  <script nonce="${nonce}">
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
