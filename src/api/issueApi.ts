import { ApiClient } from './client';
import { Issue, IssueStatusSection } from './types';

export async function getMyAssignedIssues(client: ApiClient): Promise<Issue[]> {
  const response = await client.getJSON<{ assigned: IssueStatusSection }>(
    '/api/v1/user/issues/status?state=open',
  );
  return response.assigned.items;
}
