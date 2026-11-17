import * as vscode from 'vscode';
import { ApiClient } from '../api/client';
import { getIssue } from '../api/issueApi';
import { ApiError } from '../api/apiError';
import { ProjectRegistry } from '../config/projectConfig';
import { IssueTreeProvider } from '../tree/issueTreeProvider';
import { IssueTreeNode } from '../tree/issueTreeItem';
import { Issue } from '../api/types';
import { IssueDetailPanel } from '../webview/issueDetailPanel';
import { CreatePanelInitial, IssueCreatePanel } from '../webview/issueCreatePanel';

export interface IssuePanelManager {
  getPanel(owner: string, name: string, issueNumber: number): IssueDetailPanel | undefined;
  /** 지금 열려 있는 "새 이슈" 폼이다. 없으면 `undefined`이다. */
  getCreateForm(): IssueCreatePanel | undefined;
}

function panelKey(owner: string, name: string, issueNumber: number): string {
  return `${owner}/${name}/${issueNumber}`;
}

export function registerIssueCommands(
  context: vscode.ExtensionContext,
  issueTreeProvider: IssueTreeProvider,
  getClient: () => Promise<ApiClient | undefined>,
  projectRegistry: ProjectRegistry,
): IssuePanelManager {
  const panels = new Map<string, IssueDetailPanel>();
  let createForm: IssueCreatePanel | undefined;

  /**
   * "새 이슈" 폼을 연다. 등록된 프로젝트가 없으면 안내하고, 여러 개면 폼에서 고르게 한다.
   * 이미 열린 폼이 있으면 닫고 새로 연다(미리 채울 값이 다를 수 있다).
   */
  async function openCreateForm(initial: CreatePanelInitial): Promise<void> {
    const projects = projectRegistry.list();
    if (projects.length === 0) {
      void vscode.window.showErrorMessage('먼저 "Yona: 프로젝트 등록"으로 프로젝트를 등록해주세요.');
      return;
    }
    if (!(await getClient())) {
      void vscode.window.showErrorMessage('등록된 서버/토큰이 없습니다.');
      return;
    }
    createForm?.dispose();
    const form = new IssueCreatePanel(getClient, projects, initial, (issue, ref) => {
      issueTreeProvider.refresh();
      void vscode.window.showInformationMessage(`이슈가 생성되었습니다: #${issue.number} ${issue.title}`);
      void getClient().then((client) => {
        if (client) {
          openIssuePanel(client, ref.owner, ref.name, issue);
        }
      });
    });
    createForm = form;
    form.onDidDispose(() => {
      if (createForm === form) {
        createForm = undefined;
      }
    });
  }

  function openIssuePanel(client: ApiClient, owner: string, name: string, issue: Issue): void {
    const key = panelKey(owner, name, issue.number);
    const existing = panels.get(key);
    if (existing) {
      existing.reveal();
      return;
    }

    const panel = new IssueDetailPanel(client, owner, name, issue, () => issueTreeProvider.refresh());
    panels.set(key, panel);
    panel.onDidDispose(() => panels.delete(key));
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('yona.myIssues.refresh', () => {
      issueTreeProvider.refresh();
    }),

    vscode.commands.registerCommand('yona.issue.open', async (node: Extract<IssueTreeNode, { type: 'issue' }>) => {
      const client = await getClient();
      if (!client) {
        void vscode.window.showErrorMessage('등록된 서버/토큰이 없습니다.');
        return;
      }
      // 목록 항목(v2의 issueSummary)에는 본문이 없으므로, 패널이 아직 없으면 상세를 읽어 와 그 내용으로 연다.
      // 상세 조회가 실패해도 목록 항목으로 패널은 열어 준다.
      let issue = node.issue;
      if (!panels.has(panelKey(node.owner, node.name, node.issue.number))) {
        try {
          issue = await getIssue(client, node.owner, node.name, node.issue.number);
        } catch {
          issue = node.issue;
        }
      }
      openIssuePanel(client, node.owner, node.name, issue);
    }),

    vscode.commands.registerCommand('yona.issue.openByNumber', async (issueNumber: number) => {
      const client = await getClient();
      if (!client) {
        void vscode.window.showErrorMessage('등록된 서버/토큰이 없습니다.');
        return;
      }

      for (const project of projectRegistry.list()) {
        try {
          const issue = await getIssue(client, project.owner, project.name, issueNumber);
          openIssuePanel(client, project.owner, project.name, issue);
          return;
        } catch (err) {
          if (!(err instanceof ApiError && err.status === 404)) {
            throw err;
          }
        }
      }

      void vscode.window.showErrorMessage(`등록된 프로젝트에서 #${issueNumber} 이슈를 찾을 수 없습니다.`);
    }),

    // 트리의 프로젝트 항목(또는 그 아래 이슈)에서 열면 그 프로젝트를 미리 고르고, 제목줄에서 열면 고르지 않은 채 연다.
    vscode.commands.registerCommand('yona.issue.create', async (node?: IssueTreeNode) => {
      const project = node && node.type !== 'empty' ? { owner: node.owner, name: node.name } : undefined;
      await openCreateForm({ project });
    }),

    vscode.commands.registerCommand('yona.issue.createFromLine', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        void vscode.window.showErrorMessage('활성화된 편집기가 없습니다.');
        return;
      }
      const path = vscode.workspace.asRelativePath(editor.document.uri);
      const line = editor.selection.active.line + 1;
      await openCreateForm({ body: `${path}:${line}` });
    }),
  );

  return {
    getPanel: (owner, name, issueNumber) => panels.get(panelKey(owner, name, issueNumber)),
    getCreateForm: () => createForm,
  };
}
