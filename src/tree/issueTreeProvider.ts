import * as vscode from 'vscode';
import { ApiClient } from '../api/client';
import { getProjectIssues } from '../api/issueApi';
import { ProjectRegistry } from '../config/projectConfig';
import { IssueTreeNode } from './issueTreeItem';

export class IssueTreeProvider implements vscode.TreeDataProvider<IssueTreeNode> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  constructor(
    private readonly getClient: () => Promise<ApiClient | undefined>,
    private readonly projectRegistry: ProjectRegistry,
  ) {}

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }

  async getChildren(element?: IssueTreeNode): Promise<IssueTreeNode[]> {
    if (!element) {
      const client = await this.getClient();
      if (!client) {
        return [];
      }
      return this.projectRegistry.list().map((project) => ({
        type: 'project',
        owner: project.owner,
        name: project.name,
      }));
    }

    if (element.type === 'project') {
      const client = await this.getClient();
      if (!client) {
        return [];
      }
      const issues = await getProjectIssues(client, element.owner, element.name);
      return issues.map((issue) => ({ type: 'issue', owner: element.owner, name: element.name, issue }));
    }

    return [];
  }

  getTreeItem(element: IssueTreeNode): vscode.TreeItem {
    if (element.type === 'project') {
      return new vscode.TreeItem(`${element.owner}/${element.name}`, vscode.TreeItemCollapsibleState.Collapsed);
    }

    const item = new vscode.TreeItem(
      `#${element.issue.number} ${element.issue.title}`,
      vscode.TreeItemCollapsibleState.None,
    );
    item.description = element.issue.assignee?.name ?? element.issue.authorLoginId;
    item.command = {
      command: 'yona.issue.open',
      title: '이슈 열기',
      arguments: [element],
    };
    return item;
  }
}
