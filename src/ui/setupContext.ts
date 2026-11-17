import * as vscode from 'vscode';
import { SetupState } from './setupState';

/** `package.json`의 `viewsWelcome`이 `when` 조건으로 읽는 컨텍스트 키를 설정한다. */
export async function applySetupContexts(state: SetupState): Promise<void> {
  await vscode.commands.executeCommand('setContext', 'yona.hasServer', state.hasServer);
  await vscode.commands.executeCommand('setContext', 'yona.hasToken', state.hasToken);
  await vscode.commands.executeCommand('setContext', 'yona.hasProject', state.hasProject);
}
