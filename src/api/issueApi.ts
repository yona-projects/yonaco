import { ApiClient } from './client';
import { Issue, IssueComment, IssueStatusSection, Page } from './types';

export async function getMyAssignedIssues(client: ApiClient): Promise<Issue[]> {
  const response = await client.getJSON<{ assigned: IssueStatusSection }>(
    '/api/v1/user/issues/status?state=open',
  );
  return response.assigned.items;
}

export async function getProjectIssues(client: ApiClient, owner: string, project: string): Promise<Issue[]> {
  const page = await client.getJSON<Page<Issue>>(
    `/api/v1/projects/${owner}/${project}/issues?state=open`,
  );
  return page.content;
}

export async function getIssue(
  client: ApiClient,
  owner: string,
  project: string,
  number: number,
): Promise<Issue> {
  return client.getJSON<Issue>(`/api/v1/projects/${owner}/${project}/issues/${number}`);
}

export async function addIssueComment(
  client: ApiClient,
  owner: string,
  project: string,
  number: number,
  contents: string,
): Promise<IssueComment> {
  return client.postJSON<IssueComment>(`/api/v1/projects/${owner}/${project}/issues/${number}/comments`, {
    contents,
  });
}
