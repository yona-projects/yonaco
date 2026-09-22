import * as vscode from 'vscode';
import { IssueTreeProvider } from '../tree/issueTreeProvider';

export function registerIssueCommands(
  context: vscode.ExtensionContext,
  issueTreeProvider: IssueTreeProvider,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('yona.myIssues.refresh', () => {
      issueTreeProvider.refresh();
    }),
  );
}
