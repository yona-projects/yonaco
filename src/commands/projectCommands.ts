import * as vscode from 'vscode';
import { ProjectRegistry } from '../config/projectConfig';
import { promptAddProject } from '../config/projectPrompt';
import { Prompter } from '../auth/loginFlow';
import { vscodePrompter } from './serverCommands';
import { IssueTreeProvider } from '../tree/issueTreeProvider';

export function registerProjectCommands(
  context: vscode.ExtensionContext,
  projectRegistry: ProjectRegistry,
  issueTreeProvider: IssueTreeProvider,
  prompter: Prompter = vscodePrompter,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('yona.project.add', async () => {
      const ref = await promptAddProject(prompter, projectRegistry);
      if (ref) {
        issueTreeProvider.refresh();
        void vscode.window.showInformationMessage(`프로젝트가 등록되었습니다: ${ref.owner}/${ref.name}`);
      } else {
        void vscode.window.showErrorMessage('프로젝트 등록에 실패했습니다. "owner/name" 형식으로 입력해주세요.');
      }
    }),
  );
}
