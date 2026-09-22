import { Issue } from '../api/types';

export interface IssueProjectGroup {
  projectId: number;
  issues: Issue[];
}

export function groupIssuesByProject(issues: Issue[]): IssueProjectGroup[] {
  const byProjectId = new Map<number, Issue[]>();
  for (const issue of issues) {
    const group = byProjectId.get(issue.projectId);
    if (group) {
      group.push(issue);
    } else {
      byProjectId.set(issue.projectId, [issue]);
    }
  }

  return [...byProjectId.entries()]
    .sort(([a], [b]) => a - b)
    .map(([projectId, projectIssues]) => ({ projectId, issues: projectIssues }));
}
