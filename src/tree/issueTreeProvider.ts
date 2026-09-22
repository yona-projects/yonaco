import * as vscode from 'vscode';
import { ApiClient } from '../api/client';
import { getMyAssignedIssues } from '../api/issueApi';
import { groupIssuesByProject, IssueProjectGroup } from './issueGrouping';
import { IssueTreeNode } from './issueTreeItem';

export class IssueTreeProvider implements vscode.TreeDataProvider<IssueTreeNode> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  private groups: IssueProjectGroup[] = [];

  constructor(private readonly getClient: () => Promise<ApiClient | undefined>) {}

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }

  async getChildren(element?: IssueTreeNode): Promise<IssueTreeNode[]> {
    if (!element) {
      const client = await this.getClient();
      if (!client) {
        this.groups = [];
        return [];
      }
      const issues = await getMyAssignedIssues(client);
      this.groups = groupIssuesByProject(issues);
      return this.groups.map((group) => ({
        type: 'project',
        projectId: group.projectId,
        issueCount: group.issues.length,
      }));
    }

    if (element.type === 'project') {
      const group = this.groups.find((g) => g.projectId === element.projectId);
      return (group?.issues ?? []).map((issue) => ({ type: 'issue', issue }));
    }

    return [];
  }

  getTreeItem(element: IssueTreeNode): vscode.TreeItem {
    if (element.type === 'project') {
      const item = new vscode.TreeItem(`프로젝트 #${element.projectId}`, vscode.TreeItemCollapsibleState.Expanded);
      item.description = `${element.issueCount}개`;
      return item;
    }

    const item = new vscode.TreeItem(
      `#${element.issue.number} ${element.issue.title}`,
      vscode.TreeItemCollapsibleState.None,
    );
    item.description = element.issue.assignee?.name ?? element.issue.authorLoginId;
    return item;
  }
}
