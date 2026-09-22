import * as vscode from 'vscode';
import { ApiClient } from '../api/client';
import { addIssueComment, closeIssue, getIssueComments, reopenIssue } from '../api/issueApi';
import { Issue, IssueComment } from '../api/types';

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
