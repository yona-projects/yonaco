import * as vscode from 'vscode';
import { ApiClient } from '../api/client';
import { getProjectIssues } from '../api/issueApi';
import { ProjectRegistry } from '../config/projectConfig';
import { IssueTreeNode } from './issueTreeItem';
import { describeIssueItem } from './issueTreePresentation';

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
      if (issues.length === 0) {
        return [{ type: 'empty', owner: element.owner, name: element.name }];
      }
      return issues.map((issue) => ({ type: 'issue', owner: element.owner, name: element.name, issue }));
    }

    return [];
  }

  getTreeItem(element: IssueTreeNode): vscode.TreeItem {
    if (element.type === 'project') {
      const item = new vscode.TreeItem(`${element.owner}/${element.name}`, vscode.TreeItemCollapsibleState.Expanded);
      item.iconPath = new vscode.ThemeIcon('repo');
      // package.json의 view/item/context 메뉴가 이 값으로 프로젝트 항목에만 버튼을 붙인다.
      item.contextValue = 'yona.project';
      item.tooltip = '프로젝트 (오른쪽 아이콘으로 브라우저 열기, 제거)';
      return item;
    }

    if (element.type === 'empty') {
      const item = new vscode.TreeItem('열린 이슈가 없습니다', vscode.TreeItemCollapsibleState.None);
      item.iconPath = new vscode.ThemeIcon('pass');
      item.contextValue = 'yona.empty';
      return item;
    }

    const text = describeIssueItem(element.issue);
    const item = new vscode.TreeItem(text.label, vscode.TreeItemCollapsibleState.None);
    item.description = text.description;
    item.tooltip = text.tooltip;
    item.iconPath = new vscode.ThemeIcon('issues', new vscode.ThemeColor('charts.green'));
    item.contextValue = 'yona.issue';
    item.command = {
      command: 'yona.issue.open',
      title: '이슈 열기',
      arguments: [element],
    };
    return item;
  }
}
