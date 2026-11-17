import * as vscode from 'vscode';
import { ProjectRegistry } from '../config/projectConfig';
import { promptAddProject } from '../config/projectPrompt';
import { Prompter } from '../auth/loginFlow';
import { vscodePrompter } from './serverCommands';
import { ApiClient } from '../api/client';
import { getMyProjects } from '../api/issueApi';
import { projectPickItems, ProjectPickItem } from '../config/projectPick';
import { IssueTreeProvider } from '../tree/issueTreeProvider';
import { IssueTreeNode } from '../tree/issueTreeItem';

export function registerProjectCommands(
  context: vscode.ExtensionContext,
  projectRegistry: ProjectRegistry,
  issueTreeProvider: IssueTreeProvider,
  getClient: () => Promise<ApiClient | undefined>,
  prompter: Prompter = vscodePrompter,
): void {
  context.subscriptions.push(
    // 내가 속한 프로젝트 가운데 아직 등록하지 않은 것을 여러 개 고르게 한다. 목록을 읽지 못하거나 고를 것이 없으면 owner/name을 직접 입력받는다.
    vscode.commands.registerCommand('yona.project.add', async () => {
      const added: string[] = [];
      let manual = true;

      const client = await getClient();
      const items = client ? await mineNotRegistered(client, projectRegistry) : [];
      if (items.length > 0) {
        const picked = await vscode.window.showQuickPick(items, {
          canPickMany: true,
          placeHolder: '등록할 프로젝트를 고르세요 (여러 개 선택 가능)',
          ignoreFocusOut: true,
        });
        if (!picked) {
          return;
        }
        manual = picked.some((item) => !item.ref);
        for (const item of picked) {
          if (item.ref) {
            await projectRegistry.add(item.ref.owner, item.ref.name);
            added.push(item.label);
          }
        }
      }

      if (manual) {
        const ref = await promptAddProject(prompter, projectRegistry);
        if (ref) {
          added.push(`${ref.owner}/${ref.name}`);
        } else if (added.length === 0) {
          void vscode.window.showErrorMessage('프로젝트 등록에 실패했습니다. "owner/name" 형식으로 입력해주세요.');
          return;
        }
      }

      if (added.length > 0) {
        issueTreeProvider.refresh();
        void vscode.window.showInformationMessage(`프로젝트가 등록되었습니다: ${added.join(', ')}`);
      }
    }),

    // 트리의 프로젝트 항목에서 목록에서만 뺀다(서버의 프로젝트는 그대로이다).
    vscode.commands.registerCommand('yona.project.remove', async (node?: IssueTreeNode) => {
      if (!node || node.type !== 'project') {
        return;
      }
      await projectRegistry.remove(node.owner, node.name);
      issueTreeProvider.refresh();
      void vscode.window.showInformationMessage(`프로젝트를 목록에서 제거했습니다: ${node.owner}/${node.name}`);
    }),
  );
}

/** 내가 속한 프로젝트 중 등록하지 않은 것의 선택 항목이다. 서버에서 읽지 못하면 빈 배열이다. */
async function mineNotRegistered(client: ApiClient, registry: ProjectRegistry): Promise<ProjectPickItem[]> {
  try {
    return projectPickItems(await getMyProjects(client), registry.list());
  } catch {
    return [];
  }
}
