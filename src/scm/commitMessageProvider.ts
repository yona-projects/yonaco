import * as vscode from 'vscode';
import { ApiClient } from '../api/client';
import { getProjectIssues } from '../api/issueApi';
import { ProjectRegistry } from '../config/projectConfig';
import { buildIssueCompletionItems, IssueCompletionSource } from './issueCompletionItems';
import { findIssueReferences } from './issueReferenceParser';

export const SCM_INPUT_SELECTOR: vscode.DocumentSelector = { scheme: 'vscode-scm' };

export function createIssueCompletionProvider(
  getClient: () => Promise<ApiClient | undefined>,
  projectRegistry: ProjectRegistry,
): vscode.CompletionItemProvider {
  return {
    async provideCompletionItems(): Promise<vscode.CompletionItem[]> {
      const client = await getClient();
      if (!client) {
        return [];
      }

      const sources: IssueCompletionSource[] = (
        await Promise.all(
          projectRegistry.list().map(async (project) => {
            const issues = await getProjectIssues(client, project.owner, project.name);
            return issues.map((issue) => ({ owner: project.owner, name: project.name, issue }));
          }),
        )
      ).flat();

      return buildIssueCompletionItems(sources).map((item) => {
        const completion = new vscode.CompletionItem(item.label, vscode.CompletionItemKind.Reference);
        completion.insertText = item.insertText;
        completion.detail = item.detail;
        return completion;
      });
    },
  };
}

export function createIssueLinkProvider(): vscode.DocumentLinkProvider {
  return {
    provideDocumentLinks(document: vscode.TextDocument): vscode.DocumentLink[] {
      return findIssueReferences(document.getText()).map((ref) => {
        const range = new vscode.Range(document.positionAt(ref.start), document.positionAt(ref.end));
        const args = encodeURIComponent(JSON.stringify([ref.number]));
        return new vscode.DocumentLink(range, vscode.Uri.parse(`command:yona.issue.openByNumber?${args}`));
      });
    },
  };
}

export function registerCommitMessageProviders(
  context: vscode.ExtensionContext,
  getClient: () => Promise<ApiClient | undefined>,
  projectRegistry: ProjectRegistry,
): void {
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      SCM_INPUT_SELECTOR,
      createIssueCompletionProvider(getClient, projectRegistry),
      '#',
    ),
    vscode.languages.registerDocumentLinkProvider(SCM_INPUT_SELECTOR, createIssueLinkProvider()),
  );
}
