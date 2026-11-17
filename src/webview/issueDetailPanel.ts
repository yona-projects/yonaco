import * as vscode from 'vscode';
import { ApiClient } from '../api/client';
import { addIssueComment, closeIssue, getIssue, getIssueComments, reopenIssue } from '../api/issueApi';
import { Issue, IssueComment } from '../api/types';
import { issueWebUrl } from '../api/webUrls';
import { describeDue } from '../api/dueDate';
import { labelTextColor, safeColor } from './labelColor';
import { renderMarkdown } from './markdown';

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

  /** 이슈와 댓글을 서버에서 다시 읽어 화면을 갱신한다. */
  private async reload(): Promise<void> {
    this.issue = await getIssue(this.client, this.owner, this.project, this.issue.number);
    const fresh = await getIssueComments(this.client, this.owner, this.project, this.issue.number);
    this.comments.splice(0, this.comments.length, ...fresh);
    this.panel.title = `#${this.issue.number} ${this.issue.title}`;
    this.render();
    this.onIssueChanged?.();
  }

  async handleMessage(message: { type: string; contents?: string }): Promise<void> {
    if (message.type === 'openInBrowser') {
      await vscode.env.openExternal(
        vscode.Uri.parse(issueWebUrl(this.client.serverUrl, this.owner, this.project, this.issue.number)),
      );
      return;
    }

    if (message.type === 'refresh') {
      await this.reload();
      return;
    }

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
        <div class="comment-body markdown-body">${renderMarkdown(comment.contents)}</div>
      </div>`,
      )
      .join('');

    const stateButtonHtml = isOpen
      ? '<button id="closeButton" class="secondary" title="이슈를 닫습니다">완료</button>'
      : '<button id="reopenButton" class="secondary" title="이슈를 다시 엽니다">재오픈</button>';

    const metaParts = [
      `작성자 ${escapeHtml(this.issue.authorName ?? this.issue.authorLoginId)}`,
      this.issue.createdDate ? `${escapeHtml(formatDate(this.issue.createdDate))} 작성` : '',
      `댓글 ${this.comments.length}`,
    ].filter((part) => part.length > 0);

    const due = describeDue(this.issue.dueDate, this.issue.state);
    const dueText = due
      ? `${escapeHtml(due.date)}${due.text ? ` <span class="due-${due.status}">(${escapeHtml(due.text)})</span>` : ''}`
      : '';
    const labelsHtml = (this.issue.labels ?? [])
      .map(
        (label) =>
          `<span class="label-chip" style="background-color:${safeColor(label.color)};color:${labelTextColor(label.color)}">${escapeHtml(label.name)}</span>`,
      )
      .join(' ');
    const property = (label: string, value: string) =>
      `<div class="property"><span class="property-label">${label}</span><span class="property-value">${value || '<span class="empty">없음</span>'}</span></div>`;
    const propertiesHtml = [
      property('담당자', this.issue.assignee ? escapeHtml(this.issue.assignee.name) : ''),
      property('마일스톤', this.issue.milestone ? escapeHtml(this.issue.milestone) : ''),
      property('기한', dueText),
      property('라벨', labelsHtml),
    ].join('');

    this.panel.webview.html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
</head>
<body>
  <div class="issue-header">
    <div class="title-block">
      <div class="title-row">
        <span class="issue-number">#${this.issue.number}</span>
        <h1 class="issue-title">${escapeHtml(this.issue.title)}</h1>
        <span class="state-badge ${isOpen ? 'state-open' : 'state-closed'}">${escapeHtml(this.issue.state)}</span>
      </div>
      <div class="issue-meta">${metaParts.join(' · ')}</div>
    </div>
    <div class="toolbar">
      ${stateButtonHtml}
      <button id="openBrowserButton" class="secondary" title="브라우저에서 이슈 화면을 엽니다">브라우저에서 열기</button>
      <button id="refreshButton" class="secondary" title="이슈와 코멘트를 다시 읽습니다">새로고침</button>
    </div>
  </div>

  <div class="properties">${propertiesHtml}</div>

  <div class="issue-body markdown-body">${renderMarkdown(this.issue.body ?? '') || '<span class="empty">본문이 없습니다.</span>'}</div>

  <h2 class="section-title">코멘트 <span class="count">${this.comments.length}</span></h2>
  <div id="comments" class="comments">${commentsHtml || '<div class="empty">아직 코멘트가 없습니다.</div>'}</div>

  <div class="comment-form">
    <textarea id="commentInput" placeholder="코멘트를 입력하세요... (Markdown 사용 가능)"></textarea>
    <div class="form-row">
      <span class="hint">Ctrl+Enter로 작성</span>
      <button id="submitButton" disabled>코멘트 작성</button>
    </div>
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
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
      padding: 16px 0;
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    .title-block {
      flex: 1;
      min-width: 240px;
    }

    .title-row {
      display: flex;
      align-items: baseline;
      gap: 8px;
      flex-wrap: wrap;
    }

    .issue-meta {
      margin-top: 6px;
      font-size: 0.9em;
      color: var(--vscode-descriptionForeground);
    }

    .properties {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 32px;
      padding: 12px 0;
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    .property {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 120px;
    }

    .property-label {
      font-size: 0.8em;
      color: var(--vscode-descriptionForeground);
    }

    .property-value {
      font-weight: 600;
    }

    .property-value .empty {
      font-weight: normal;
    }

    .label-chip {
      display: inline-block;
      padding: 1px 8px;
      border-radius: 999px;
      font-size: 0.85em;
      font-weight: 600;
      line-height: 1.5;
    }

    .due-overdue {
      color: var(--vscode-charts-red);
    }

    .due-today {
      color: var(--vscode-charts-orange);
    }

    .due-upcoming {
      color: var(--vscode-descriptionForeground);
      font-weight: normal;
    }

    .toolbar {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .empty {
      color: var(--vscode-descriptionForeground);
      font-style: italic;
    }

    .count {
      font-weight: normal;
      padding: 0 6px;
      border-radius: 999px;
      background-color: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
    }

    .form-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .hint {
      font-size: 0.85em;
      color: var(--vscode-descriptionForeground);
    }

    button:disabled {
      opacity: 0.5;
      cursor: default;
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
      line-height: 1.5;
      padding: 16px 0;
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
      line-height: 1.5;
    }

    .markdown-body :first-child {
      margin-top: 0;
    }

    .markdown-body :last-child {
      margin-bottom: 0;
    }

    .markdown-body code {
      font-family: var(--vscode-editor-font-family, monospace);
      background-color: var(--vscode-textCodeBlock-background);
      padding: 0.1em 0.4em;
      border-radius: 4px;
    }

    .markdown-body pre {
      font-family: var(--vscode-editor-font-family, monospace);
      background-color: var(--vscode-textCodeBlock-background);
      padding: 10px 12px;
      border-radius: 4px;
      overflow-x: auto;
    }

    .markdown-body pre code {
      padding: 0;
      background-color: transparent;
    }

    .markdown-body blockquote {
      margin: 0;
      padding: 0 12px;
      color: var(--vscode-descriptionForeground);
      border-left: 3px solid var(--vscode-textBlockQuote-border, var(--vscode-panel-border));
    }

    .markdown-body a {
      color: var(--vscode-textLink-foreground);
    }

    .markdown-body a:hover {
      color: var(--vscode-textLink-activeForeground);
    }

    .markdown-body ul,
    .markdown-body ol {
      padding-left: 1.6em;
    }

    .markdown-body h1,
    .markdown-body h2,
    .markdown-body h3,
    .markdown-body h4,
    .markdown-body h5,
    .markdown-body h6 {
      font-weight: 600;
      line-height: 1.3;
    }

    .markdown-body h1 {
      font-size: 1.8em;
      padding-bottom: 0.3em;
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    .markdown-body h2 {
      font-size: 1.5em;
      padding-bottom: 0.3em;
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    .markdown-body h3 {
      font-size: 1.25em;
    }

    .markdown-body h4 {
      font-size: 1.1em;
    }

    .markdown-body h5,
    .markdown-body h6 {
      font-size: 1em;
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
    const input = document.getElementById('commentInput');
    const submit = document.getElementById('submitButton');
    const send = () => {
      if (input.value.trim().length === 0) {
        return;
      }
      vscode.postMessage({ type: 'addComment', contents: input.value });
      input.value = '';
      submit.disabled = true;
    };
    input.addEventListener('input', () => { submit.disabled = input.value.trim().length === 0; });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        send();
      }
    });
    submit.addEventListener('click', send);
    document.getElementById('openBrowserButton').addEventListener('click', () => vscode.postMessage({ type: 'openInBrowser' }));
    document.getElementById('refreshButton').addEventListener('click', () => vscode.postMessage({ type: 'refresh' }));
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
