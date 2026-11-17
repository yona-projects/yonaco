import * as vscode from 'vscode';
import { ApiClient } from '../api/client';
import {
  createIssue,
  getAssignableUsers,
  getLabels,
  getMilestones,
  IssueCreatedPartiallyError,
} from '../api/issueApi';
import { Issue, IssueAssignee, LabelOption, MilestoneOption } from '../api/types';
import { ProjectRef } from '../config/projectConfig';
import { escapeHtml, getNonce } from './htmlUtil';
import { labelTextColor, safeColor } from './labelColor';

/** 폼이 프로젝트마다 읽어 오는 선택지이다. */
export interface CreateFormOptions {
  assignees: IssueAssignee[];
  milestones: MilestoneOption[];
  labels: LabelOption[];
}

/** 웹뷰가 보내는 "만들기" 메시지이다. */
export interface SubmitMessage {
  type: 'submit';
  /** `owner/name` */
  project: string;
  title: string;
  body: string;
  assignee: string;
  milestoneId: number | null;
  dueDate: string;
  labelIds: number[];
}

/** 웹뷰가 프로젝트를 바꿀 때 보내는 "선택지 읽기" 메시지이다. */
export interface LoadOptionsMessage {
  type: 'loadOptions';
  /** `owner/name` */
  project: string;
}

export interface CreatePanelInitial {
  /** 미리 고를 프로젝트. 등록된 프로젝트가 하나뿐이면 이것과 상관없이 그 프로젝트가 선택된다. */
  project?: ProjectRef;
  /** 본문 입력칸에 미리 채울 글. "이 라인으로 이슈 생성"이 `파일경로:줄번호`를 넣는다. */
  body?: string;
}

const key = (ref: ProjectRef) => `${ref.owner}/${ref.name}`;

/**
 * 이슈를 만드는 폼 패널이다. 상세 패널이 보여 주는 항목(담당자, 마일스톤, 기한, 라벨)을 같은 이름으로 입력받는다.
 * 프로젝트가 여러 개 등록되어 있으면 프로젝트를 고르게 하고, 고를 때마다 그 프로젝트의 선택지를 서버에서 읽어 온다.
 */
export class IssueCreatePanel {
  private readonly panel: vscode.WebviewPanel;
  private loading: Promise<void> = Promise.resolve();
  /** 가장 최근에 읽어 온 선택지이다(통합 시험이 확인한다). */
  options: (CreateFormOptions & { project: string }) | undefined;
  /** 가장 최근에 폼에 보여 준 오류이다(통합 시험이 확인한다). */
  lastError: string | undefined;

  constructor(
    private readonly getClient: () => Promise<ApiClient | undefined>,
    private readonly projects: ProjectRef[],
    initial: CreatePanelInitial,
    private readonly onCreated: (issue: Issue, project: ProjectRef) => void,
  ) {
    this.panel = vscode.window.createWebviewPanel('yonaIssueCreate', '새 이슈', vscode.ViewColumn.One, {
      enableScripts: true,
    });
    const selected = projects.length === 1 ? projects[0] : initial.project;
    this.panel.webview.html = this.render(selected, initial.body ?? '');
    this.panel.webview.onDidReceiveMessage((message) => this.handleMessage(message));
    if (selected) {
      this.loading = this.loadOptions(key(selected));
    }
  }

  get html(): string {
    return this.panel.webview.html;
  }

  /** 통합 시험이 선택지 읽기가 끝난 뒤를 확인할 수 있게 노출한다. */
  waitUntilLoaded(): Promise<void> {
    return this.loading;
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

  async handleMessage(message: SubmitMessage | LoadOptionsMessage): Promise<void> {
    if (message.type === 'loadOptions') {
      if (message.project) {
        this.loading = this.loadOptions(message.project);
        await this.loading;
      }
      return;
    }
    if (message.type === 'submit') {
      await this.submit(message);
    }
  }

  private parse(project: string): ProjectRef | undefined {
    return this.projects.find((p) => key(p) === project);
  }

  private async loadOptions(project: string): Promise<void> {
    const ref = this.parse(project);
    const client = await this.getClient();
    if (!ref || !client) {
      return;
    }
    try {
      const [assignees, milestones, labels] = await Promise.all([
        getAssignableUsers(client, ref.owner, ref.name),
        getMilestones(client, ref.owner, ref.name),
        getLabels(client, ref.owner, ref.name),
      ]);
      this.options = { project, assignees, milestones, labels };
      // 라벨 색은 웹뷰의 스타일에 들어가므로 검사한 값과 읽기 좋은 글자색을 함께 보낸다.
      const chips = labels.map((l) => ({ ...l, color: safeColor(l.color), textColor: labelTextColor(l.color) }));
      void this.panel.webview.postMessage({ type: 'options', project, assignees, milestones, labels: chips });
    } catch (err) {
      this.showError(`선택지를 읽지 못했습니다: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private showError(message: string): void {
    this.lastError = message;
    void this.panel.webview.postMessage({ type: 'error', message });
  }

  private async submit(message: SubmitMessage): Promise<void> {
    const ref = this.parse(message.project);
    if (!ref) {
      this.showError('프로젝트를 선택하세요.');
      return;
    }
    if (!message.title || message.title.trim().length === 0) {
      this.showError('제목을 입력하세요.');
      return;
    }
    const client = await this.getClient();
    if (!client) {
      this.showError('등록된 서버/토큰이 없습니다.');
      return;
    }
    this.lastError = undefined;
    void this.panel.webview.postMessage({ type: 'busy', busy: true });
    try {
      const issue = await createIssue(client, ref.owner, ref.name, message.title.trim(), message.body, {
        dueDate: message.dueDate || undefined,
        assignee: message.assignee || undefined,
        milestoneId: message.milestoneId ?? undefined,
        labelIds: message.labelIds,
      });
      this.onCreated(issue, ref);
      this.panel.dispose();
    } catch (err) {
      void this.panel.webview.postMessage({ type: 'busy', busy: false });
      if (err instanceof IssueCreatedPartiallyError) {
        // 이슈는 이미 만들어졌으므로 폼을 닫고 알린다. 다시 눌러 같은 이슈를 또 만들지 않게 한다.
        void vscode.window.showWarningMessage(err.message);
        this.panel.dispose();
        return;
      }
      this.showError(`이슈를 만들지 못했습니다: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private render(selected: ProjectRef | undefined, body: string): string {
    const nonce = getNonce();
    const projectOptions = this.projects
      .map((p) => `<option value="${escapeHtml(key(p))}"${selected && key(p) === key(selected) ? ' selected' : ''}>${escapeHtml(key(p))}</option>`)
      .join('');
    const placeholder = selected ? '' : '<option value="" selected disabled>프로젝트를 선택하세요</option>';

    return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
</head>
<body>
  <h1 class="page-title">새 이슈</h1>
  <form id="form" autocomplete="off">
    <label class="field">
      <span class="field-label">프로젝트</span>
      <select id="project"${this.projects.length === 1 ? ' disabled' : ''}>${placeholder}${projectOptions}</select>
    </label>
    <label class="field">
      <span class="field-label">제목</span>
      <input id="title" type="text" placeholder="이슈 제목">
    </label>
    <label class="field">
      <span class="field-label">본문 <span class="hint">(Markdown 사용 가능)</span></span>
      <textarea id="body" placeholder="내용을 입력하세요...">${escapeHtml(body)}</textarea>
    </label>
    <div class="row">
      <label class="field">
        <span class="field-label">담당자</span>
        <select id="assignee"><option value="">없음</option></select>
      </label>
      <label class="field">
        <span class="field-label">마일스톤</span>
        <select id="milestone"><option value="">없음</option></select>
      </label>
      <label class="field">
        <span class="field-label">기한</span>
        <input id="dueDate" type="date">
      </label>
    </div>
    <div class="field">
      <span class="field-label">라벨</span>
      <div id="labels" class="labels"><span class="hint">프로젝트를 선택하면 라벨이 나타납니다.</span></div>
    </div>
    <div id="error" class="error" role="alert" hidden></div>
    <div class="form-row">
      <span class="hint">Ctrl+Enter로 만들기</span>
      <button id="submitButton" type="submit" disabled>이슈 만들기</button>
    </div>
  </form>

  <style>
    body { font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); padding: 0 20px 24px; max-width: 860px; }
    .page-title { font-size: 1.3em; font-weight: 600; padding: 16px 0 8px; margin: 0; border-bottom: 1px solid var(--vscode-panel-border); }
    form { display: flex; flex-direction: column; gap: 14px; padding-top: 14px; }
    .field { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 160px; }
    .field-label { font-size: 0.85em; font-weight: 600; color: var(--vscode-descriptionForeground); }
    .row { display: flex; flex-wrap: wrap; gap: 14px; }
    .hint { font-weight: normal; font-size: 0.85em; color: var(--vscode-descriptionForeground); }
    input, select, textarea, button { font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); }
    input, select, textarea { padding: 6px 8px; color: var(--vscode-input-foreground); background-color: var(--vscode-input-background); border: 1px solid var(--vscode-input-border, var(--vscode-panel-border)); border-radius: 4px; }
    select { color: var(--vscode-dropdown-foreground); background-color: var(--vscode-dropdown-background); border-color: var(--vscode-dropdown-border, var(--vscode-panel-border)); }
    textarea { min-height: 140px; resize: vertical; }
    input:focus, select:focus, textarea:focus { outline: 1px solid var(--vscode-focusBorder); outline-offset: -1px; }
    .labels { display: flex; flex-wrap: wrap; gap: 8px; }
    .label-option { display: inline-flex; align-items: center; gap: 4px; cursor: pointer; }
    .label-chip { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 0.85em; font-weight: 600; line-height: 1.5; }
    .error { padding: 8px 12px; border-radius: 4px; color: var(--vscode-errorForeground); border: 1px solid var(--vscode-inputValidation-errorBorder, var(--vscode-errorForeground)); background-color: var(--vscode-inputValidation-errorBackground, transparent); }
    .form-row { display: flex; justify-content: space-between; align-items: center; }
    button { padding: 6px 16px; border: none; border-radius: 4px; cursor: pointer; color: var(--vscode-button-foreground); background-color: var(--vscode-button-background); }
    button:hover { background-color: var(--vscode-button-hoverBackground); }
    button:disabled { opacity: 0.5; cursor: default; }
  </style>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const $ = (id) => document.getElementById(id);
    const project = $('project'), title = $('title'), submit = $('submitButton');
    const refresh = () => { submit.disabled = !(project.value && title.value.trim().length > 0); };

    const fill = (select, items, text, value) => {
      select.length = 1;
      items.forEach((item) => { const o = document.createElement('option'); o.value = value(item); o.textContent = text(item); select.appendChild(o); });
    };

    window.addEventListener('message', (event) => {
      const m = event.data;
      if (m.type === 'options' && m.project === project.value) {
        fill($('assignee'), m.assignees, (u) => u.name + ' (' + u.loginId + ')', (u) => u.loginId);
        fill($('milestone'), m.milestones, (x) => x.title + (x.dueDate ? ' · ' + x.dueDate : ''), (x) => String(x.id));
        const box = $('labels');
        box.textContent = '';
        if (m.labels.length === 0) { const s = document.createElement('span'); s.className = 'hint'; s.textContent = '이 프로젝트에는 라벨이 없습니다.'; box.appendChild(s); }
        m.labels.forEach((l) => {
          const wrap = document.createElement('label'); wrap.className = 'label-option';
          const cb = document.createElement('input'); cb.type = 'checkbox'; cb.value = String(l.id); cb.dataset.category = l.category || ''; cb.dataset.exclusive = l.exclusive ? '1' : '';
          cb.addEventListener('change', () => {
            // 같은 분류에서 하나만 고를 수 있는 분류(배타 분류)는 다른 라벨을 해제한다
            if (cb.checked && cb.dataset.exclusive) { box.querySelectorAll('input').forEach((o) => { if (o !== cb && o.dataset.category === cb.dataset.category) o.checked = false; }); }
          });
          const chip = document.createElement('span'); chip.className = 'label-chip'; chip.textContent = l.name; chip.style.backgroundColor = l.color; chip.style.color = l.textColor;
          wrap.appendChild(cb); wrap.appendChild(chip); box.appendChild(wrap);
        });
      } else if (m.type === 'error') {
        $('error').textContent = m.message; $('error').hidden = false;
      } else if (m.type === 'busy') {
        submit.disabled = m.busy; if (!m.busy) refresh();
      }
    });

    project.addEventListener('change', () => {
      fill($('assignee'), [], () => '', () => ''); fill($('milestone'), [], () => '', () => '');
      $('labels').textContent = '';
      vscode.postMessage({ type: 'loadOptions', project: project.value });
      refresh();
    });
    title.addEventListener('input', refresh);

    const send = () => {
      if (submit.disabled) return;
      $('error').hidden = true;
      vscode.postMessage({
        type: 'submit', project: project.value, title: title.value, body: $('body').value,
        assignee: $('assignee').value, milestoneId: $('milestone').value ? Number($('milestone').value) : null,
        dueDate: $('dueDate').value,
        labelIds: Array.from($('labels').querySelectorAll('input:checked')).map((cb) => Number(cb.value)),
      });
    };
    $('form').addEventListener('submit', (e) => { e.preventDefault(); send(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(); });
    refresh();
    title.focus();
  </script>
</body>
</html>`;
  }
}
