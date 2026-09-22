import * as assert from 'assert';
import { ApiClient } from '../../../src/api/client';
import { getMyAssignedIssues } from '../../../src/api/issueApi';
import { Issue } from '../../../src/api/types';

function fakeIssue(overrides: Partial<Issue>): Issue {
  return {
    id: 1,
    number: 1,
    title: 'title',
    state: 'OPEN',
    projectId: 1,
    authorLoginId: 'admin',
    numOfComments: 0,
    ...overrides,
  };
}

function fakeFetchReturning(body: unknown) {
  return async () =>
    ({
      status: 200,
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => body,
      text: async () => JSON.stringify(body),
    }) as unknown as Response;
}

describe('getMyAssignedIssues', () => {
  it('GET /api/v1/user/issues/status를 호출하고 assigned.items를 반환한다', async () => {
    let capturedUrl: string | undefined;
    const fetchFn = async (url: string) => {
      capturedUrl = url;
      return fakeFetchReturning({
        assigned: {
          openCount: 2,
          closedCount: 0,
          items: [fakeIssue({ id: 1, number: 1, title: '이슈1' }), fakeIssue({ id: 2, number: 2, title: '이슈2' })],
        },
      })();
    };
    const client = new ApiClient('https://yona.example.com', 'token', fetchFn);

    const issues = await getMyAssignedIssues(client);

    assert.strictEqual(capturedUrl, 'https://yona.example.com/api/v1/user/issues/status?state=open');
    assert.strictEqual(issues.length, 2);
    assert.strictEqual(issues[0].title, '이슈1');
    assert.strictEqual(issues[1].title, '이슈2');
  });

  it('assigned 섹션이 비어있으면 빈 배열을 반환한다', async () => {
    const client = new ApiClient(
      'https://yona.example.com',
      'token',
      fakeFetchReturning({ assigned: { openCount: 0, closedCount: 0, items: [] } }),
    );

    const issues = await getMyAssignedIssues(client);

    assert.deepStrictEqual(issues, []);
  });
});
