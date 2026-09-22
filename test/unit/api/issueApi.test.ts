import * as assert from 'assert';
import { ApiClient } from '../../../src/api/client';
import {
  addIssueComment,
  closeIssue,
  createIssue,
  getIssue,
  getMyAssignedIssues,
  getProjectIssues,
  reopenIssue,
} from '../../../src/api/issueApi';
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

describe('getProjectIssues', () => {
  it('GET /api/v1/projects/{owner}/{project}/issues?state=open을 호출하고 content를 반환한다', async () => {
    let capturedUrl: string | undefined;
    const fetchFn = async (url: string) => {
      capturedUrl = url;
      return fakeFetchReturning({
        content: [fakeIssue({ id: 1, title: '이슈A' })],
        totalElements: 1,
        totalPages: 1,
        number: 0,
        size: 20,
      })();
    };
    const client = new ApiClient('https://yona.example.com', 'token', fetchFn);

    const issues = await getProjectIssues(client, 'owner1', 'proj1');

    assert.strictEqual(capturedUrl, 'https://yona.example.com/api/v1/projects/owner1/proj1/issues?state=open');
    assert.strictEqual(issues.length, 1);
    assert.strictEqual(issues[0].title, '이슈A');
  });
});

describe('getIssue', () => {
  it('GET /api/v1/projects/{owner}/{project}/issues/{number}를 호출하고 이슈를 반환한다', async () => {
    let capturedUrl: string | undefined;
    const fetchFn = async (url: string) => {
      capturedUrl = url;
      return fakeFetchReturning(fakeIssue({ id: 5, number: 5, title: '상세이슈', body: '본문' }))();
    };
    const client = new ApiClient('https://yona.example.com', 'token', fetchFn);

    const issue = await getIssue(client, 'owner1', 'proj1', 5);

    assert.strictEqual(capturedUrl, 'https://yona.example.com/api/v1/projects/owner1/proj1/issues/5');
    assert.strictEqual(issue.title, '상세이슈');
    assert.strictEqual(issue.body, '본문');
  });
});

describe('createIssue', () => {
  it('POST /api/v1/projects/{owner}/{project}/issues를 호출하고 생성된 이슈를 반환한다', async () => {
    let capturedUrl: string | undefined;
    let capturedMethod: string | undefined;
    let capturedBody: unknown;
    const fetchFn = async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedMethod = init?.method;
      capturedBody = init?.body ? JSON.parse(init.body as string) : undefined;
      return fakeFetchReturning(fakeIssue({ id: 10, number: 10, title: '새 이슈', body: 'src/a.ts:3' }))();
    };
    const client = new ApiClient('https://yona.example.com', 'token', fetchFn);

    const issue = await createIssue(client, 'owner1', 'proj1', '새 이슈', 'src/a.ts:3');

    assert.strictEqual(capturedUrl, 'https://yona.example.com/api/v1/projects/owner1/proj1/issues');
    assert.strictEqual(capturedMethod, 'POST');
    assert.deepStrictEqual(capturedBody, { title: '새 이슈', body: 'src/a.ts:3' });
    assert.strictEqual(issue.title, '새 이슈');
  });
});

describe('closeIssue', () => {
  it('POST /api/v1/projects/{owner}/{project}/issues/{number}/close를 호출하고 갱신된 이슈를 반환한다', async () => {
    let capturedUrl: string | undefined;
    let capturedMethod: string | undefined;
    const fetchFn = async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedMethod = init?.method;
      return fakeFetchReturning(fakeIssue({ id: 5, number: 5, title: '이슈', state: 'CLOSED' }))();
    };
    const client = new ApiClient('https://yona.example.com', 'token', fetchFn);

    const issue = await closeIssue(client, 'owner1', 'proj1', 5);

    assert.strictEqual(capturedUrl, 'https://yona.example.com/api/v1/projects/owner1/proj1/issues/5/close');
    assert.strictEqual(capturedMethod, 'POST');
    assert.strictEqual(issue.state, 'CLOSED');
  });
});

describe('reopenIssue', () => {
  it('POST /api/v1/projects/{owner}/{project}/issues/{number}/reopen을 호출하고 갱신된 이슈를 반환한다', async () => {
    let capturedUrl: string | undefined;
    const fetchFn = async (url: string) => {
      capturedUrl = url;
      return fakeFetchReturning(fakeIssue({ id: 5, number: 5, title: '이슈', state: 'OPEN' }))();
    };
    const client = new ApiClient('https://yona.example.com', 'token', fetchFn);

    const issue = await reopenIssue(client, 'owner1', 'proj1', 5);

    assert.strictEqual(capturedUrl, 'https://yona.example.com/api/v1/projects/owner1/proj1/issues/5/reopen');
    assert.strictEqual(issue.state, 'OPEN');
  });
});

describe('addIssueComment', () => {
  it('POST /api/v1/projects/{owner}/{project}/issues/{number}/comments를 호출하고 생성된 코멘트를 반환한다', async () => {
    let capturedUrl: string | undefined;
    let capturedMethod: string | undefined;
    let capturedBody: unknown;
    const fetchFn = async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedMethod = init?.method;
      capturedBody = init?.body ? JSON.parse(init.body as string) : undefined;
      return fakeFetchReturning({
        id: 100,
        contents: '댓글 내용',
        authorLoginId: 'admin',
        authorName: 'Admin',
        createdDate: '2026-01-01T00:00:00Z',
        issueId: 5,
      })();
    };
    const client = new ApiClient('https://yona.example.com', 'token', fetchFn);

    const comment = await addIssueComment(client, 'owner1', 'proj1', 5, '댓글 내용');

    assert.strictEqual(capturedUrl, 'https://yona.example.com/api/v1/projects/owner1/proj1/issues/5/comments');
    assert.strictEqual(capturedMethod, 'POST');
    assert.deepStrictEqual(capturedBody, { contents: '댓글 내용' });
    assert.strictEqual(comment.contents, '댓글 내용');
    assert.strictEqual(comment.authorLoginId, 'admin');
  });
});
