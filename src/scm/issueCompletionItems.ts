import { Issue } from '../api/types';

export interface IssueCompletionSource {
  owner: string;
  name: string;
  issue: Issue;
}

export interface IssueCompletionItem {
  label: string;
  insertText: string;
  detail: string;
}

export function buildIssueCompletionItems(sources: IssueCompletionSource[]): IssueCompletionItem[] {
  return sources.map(({ owner, name, issue }) => ({
    label: `#${issue.number} ${issue.title}`,
    insertText: `${issue.number}`,
    detail: `${owner}/${name}`,
  }));
}
