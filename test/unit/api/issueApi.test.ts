import * as assert from 'assert';
import { ApiClient } from '../../../src/api/client';
import {
  addIssueComment,
  closeIssue,
  createIssue,
  IssueCreatedPartiallyError,
  getAssignableUsers,
  getIssue,
  getIssueComments,
  getLabels,
  getMilestones,
  getMyAssignedIssues,
  getMyProjects,
  getProjectIssues,
  reopenIssue,
} from '../../../src/api/issueApi';

// Yona v2(next) 서버의 외부 API 계약을 그대로 흉내 낸다. 응답 모양은 서버의 IssueJson(이슈 상세와 댓글)과
// ProjectJson.issueSummary(목록 항목)에서 가져왔다.

const user = (loginId: string, name: string) => ({ loginId, name, email: `${loginId}@example.com` });

function summary(overrides: Record<string, unknown> = {}) {
  return {
    number: 1,
    id: 11,
    title: '이슈1',
    state: 'open',
    author: { loginId: 'admin', name: '관리자' },
    assignees: [],
    labels: [],
    milestone: null,
    createdAt: '2026-11-17T10:00:00+0900',
    updatedAt: '2026-11-17T11:00:00+0900',
    dueDate: null,
    numOfComments: 0,
    url: '/owner1/proj1/issue/1',
    ...overrides,
  };
}

function detail(overrides: Record<string, unknown> = {}) {
  return {
    number: 5,
    id: 55,
    title: '상세이슈',
    type: 'ISSUE_POST',
    author: user('admin', '관리자'),
    createdAt: '2026-11-17T10:00:00+0900',
    updatedAt: '2026-11-17T11:00:00+0900',
    body: '본문',
    owner: 'owner1',
    projectName: 'proj1',
    state: 'OPEN',
    refUrl: 'https://yona.example.com/owner1/proj1/issue/5',
    ...overrides,
  };
}

interface Captured {
  method?: string;
  url: string;
  body?: unknown;
}

/** "METHOD 경로"별 응답을 돌려주고 요청을 기록하는 가짜 fetch이다. */
function routedFetch(routes: Record<string, { status?: number; body: unknown }>) {
  const calls: Captured[] = [];
  const fetchFn = async (url: string, init?: RequestInit) => {
    const path = url.replace('https://yona.example.com', '');
    calls.push({ method: init?.method, url: path, body: init?.body ? JSON.parse(init.body as string) : undefined });
    const route = routes[`${init?.method} ${path}`];
    if (!route) {
      throw new Error(`예상하지 못한 요청: ${init?.method} ${path}`);
    }
    const status = route.status ?? 200;
    return {
      status,
      ok: status >= 200 && status < 300,
      headers: { get: () => 'application/json' },
      json: async () => route.body,
      text: async () => JSON.stringify(route.body),
    } as unknown as Response;
  };
  return { calls, client: new ApiClient('https://yona.example.com', 'token', fetchFn) };
}

describe('getMyAssignedIssues', () => {
  it('GET /-_-api/v1/user/status를 호출하고 assignedIssues.items를 이슈로 바꿔 반환한다', async () => {
    const { calls, client } = routedFetch({
      'GET /-_-api/v1/user/status': {
        body: {
          assignedIssues: {
            openCount: 2,
            closedCount: 0,
            items: [
              summary({ number: 1, title: '이슈1', url: '/owner1/proj1/issue/1' }),
              summary({ number: 2, id: 12, title: '이슈2', url: '/yona/owner2/proj2/issue/2' }),
            ],
          },
          assignedPullRequests: { openCount: 0, closedCount: 0, items: [] },
        },
      },
    });

    const issues = await getMyAssignedIssues(client);

    assert.strictEqual(calls[0].url, '/-_-api/v1/user/status');
    assert.strictEqual(issues.length, 2);
    assert.strictEqual(issues[0].title, '이슈1');
    assert.strictEqual(issues[0].projectOwner, 'owner1');
    assert.strictEqual(issues[0].projectName, 'proj1');
    assert.strictEqual(issues[1].projectOwner, 'owner2', '컨텍스트 경로(/yona)가 앞에 붙어도 마지막 네 마디로 소유자와 프로젝트를 알아낸다');
    assert.strictEqual(issues[1].projectName, 'proj2');
  });

  it('assignedIssues 섹션이 비어 있으면 빈 배열을 반환한다', async () => {
    const { client } = routedFetch({
      'GET /-_-api/v1/user/status': { body: { assignedIssues: { openCount: 0, closedCount: 0, items: [] } } },
    });

    assert.deepStrictEqual(await getMyAssignedIssues(client), []);
  });
});

describe('getProjectIssues', () => {
  it('GET /-_-api/v1/owners/{owner}/projects/{project}/issues?state=open을 호출하고 items를 이슈로 바꿔 반환한다', async () => {
    const { calls, client } = routedFetch({
      'GET /-_-api/v1/owners/owner1/projects/proj1/issues?state=open': {
        body: {
          items: [
            summary({
              title: '이슈A',
              state: 'open',
              assignees: [{ loginId: 'bob', name: '밥' }],
              numOfComments: 3,
            }),
          ],
          page: 1,
          pageSize: 15,
          totalPages: 1,
          totalCount: 1,
        },
      },
    });

    const issues = await getProjectIssues(client, 'owner1', 'proj1');

    assert.strictEqual(calls[0].url, '/-_-api/v1/owners/owner1/projects/proj1/issues?state=open');
    assert.strictEqual(issues.length, 1);
    const issue = issues[0];
    assert.strictEqual(issue.title, '이슈A');
    assert.strictEqual(issue.number, 1);
    assert.strictEqual(issue.state, 'OPEN', '서버의 목록은 소문자(open)이지만 화면은 OPEN으로 다룬다');
    assert.strictEqual(issue.authorLoginId, 'admin');
    assert.strictEqual(issue.authorName, '관리자');
    assert.strictEqual(issue.assignee?.loginId, 'bob');
    assert.strictEqual(issue.assignee?.name, '밥');
    assert.strictEqual(issue.numOfComments, 3);
    assert.strictEqual(issue.createdDate, '2026-11-17T10:00:00+0900');
    assert.strictEqual(issue.updatedDate, '2026-11-17T11:00:00+0900');
    assert.strictEqual(issue.projectOwner, 'owner1');
    assert.strictEqual(issue.projectName, 'proj1');
  });

  it('닫힌 이슈의 상태를 CLOSED로 바꾼다', async () => {
    const { client } = routedFetch({
      'GET /-_-api/v1/owners/owner1/projects/proj1/issues?state=open': { body: { items: [summary({ state: 'closed' })] } },
    });

    assert.strictEqual((await getProjectIssues(client, 'owner1', 'proj1'))[0].state, 'CLOSED');
  });

  it('소유자와 프로젝트 이름은 주소에 쓸 수 있게 인코딩한다(한글, 공백)', async () => {
    const owner = '소유자';
    const project = '내 프로젝트';
    const path = `/-_-api/v1/owners/${encodeURIComponent(owner)}/projects/${encodeURIComponent(project)}/issues?state=open`;
    const { calls, client } = routedFetch({ [`GET ${path}`]: { body: { items: [] } } });

    await getProjectIssues(client, owner, project);

    assert.strictEqual(calls[0].url, path);
  });
});

describe('마일스톤과 기한', () => {
  it('목록 항목의 milestone 객체와 ISO 기한을 제목과 날짜로 바꾼다', async () => {
    const { client } = routedFetch({
      'GET /-_-api/v1/owners/owner1/projects/proj1/issues?state=open': {
        body: {
          items: [
            summary({ number: 1, milestone: { id: 3, title: 'v1.0 출시' }, dueDate: '2026-11-20T23:59:59+0900' }),
            summary({ number: 2, milestone: null, dueDate: '' }),
          ],
        },
      },
    });

    const [withBoth, withNone] = await getProjectIssues(client, 'owner1', 'proj1');

    assert.strictEqual(withBoth.milestone, 'v1.0 출시');
    assert.strictEqual(withBoth.dueDate, '2026-11-20');
    assert.strictEqual(withNone.milestone, undefined);
    assert.strictEqual(withNone.dueDate, undefined);
  });

  it('상세의 milestoneTitle과 긴 날짜 기한을 제목과 날짜로 바꾼다', async () => {
    const { client } = routedFetch({
      'GET /-_-api/v1/owners/owner1/projects/proj1/issues/5': {
        body: { result: detail({ milestoneId: 3, milestoneTitle: 'v1.0 출시', dueDate: '2026-11-20 PM 11:59:59 +0900' }) },
      },
    });

    const issue = await getIssue(client, 'owner1', 'proj1', 5);

    assert.strictEqual(issue.milestone, 'v1.0 출시');
    assert.strictEqual(issue.dueDate, '2026-11-20');
  });

  it('상세에 마일스톤과 기한 키가 없으면 둘 다 undefined이다', async () => {
    const { client } = routedFetch({
      'GET /-_-api/v1/owners/owner1/projects/proj1/issues/5': { body: { result: detail() } },
    });

    const issue = await getIssue(client, 'owner1', 'proj1', 5);

    assert.strictEqual(issue.milestone, undefined);
    assert.strictEqual(issue.dueDate, undefined);
  });
});

describe('getIssue', () => {
  it('GET .../issues/{number}를 호출하고 result의 이슈를 반환한다', async () => {
    const { calls, client } = routedFetch({
      'GET /-_-api/v1/owners/owner1/projects/proj1/issues/5': {
        body: {
          result: detail({
            assignees: [user('bob', '밥')],
            comments: [
              { id: 1, type: 'ISSUE_COMMENT', author: user('admin', '관리자'), createdAt: '2026-11-17T10:10:00+0900', body: '첫 댓글', childComments: [{ id: 3, type: 'ISSUE_COMMENT', author: user('bob', '밥'), createdAt: '2026-11-17T10:20:00+0900', body: '답글' }] },
              { id: 2, type: 'ISSUE_COMMENT', author: user('bob', '밥'), createdAt: '2026-11-17T10:30:00+0900', body: '두번째' },
            ],
          }),
        },
      },
    });

    const issue = await getIssue(client, 'owner1', 'proj1', 5);

    assert.strictEqual(calls[0].url, '/-_-api/v1/owners/owner1/projects/proj1/issues/5');
    assert.strictEqual(issue.title, '상세이슈');
    assert.strictEqual(issue.body, '본문');
    assert.strictEqual(issue.state, 'OPEN');
    assert.strictEqual(issue.authorLoginId, 'admin');
    assert.strictEqual(issue.assignee?.loginId, 'bob');
    assert.strictEqual(issue.numOfComments, 3, '상세에는 댓글 수가 없어 답글까지 센다');
    assert.strictEqual(issue.projectOwner, 'owner1');
    assert.strictEqual(issue.projectName, 'proj1');
    assert.strictEqual(issue.createdDate, '2026-11-17T10:00:00+0900');
  });

  it('댓글이 없는 이슈는 댓글 수 0이다', async () => {
    const { client } = routedFetch({
      'GET /-_-api/v1/owners/owner1/projects/proj1/issues/5': { body: { result: detail() } },
    });

    assert.strictEqual((await getIssue(client, 'owner1', 'proj1', 5)).numOfComments, 0);
  });
});

describe('createIssue', () => {
  it('POST .../issues에 issues 배열로 보내고, 응답의 location에서 번호를 읽어 이슈를 다시 조회해 반환한다', async () => {
    const { calls, client } = routedFetch({
      'POST /-_-api/v1/owners/owner1/projects/proj1/issues': {
        status: 201,
        body: [{ status: 201, location: 'https://yona.example.com/owner1/proj1/issue/10' }],
      },
      'GET /-_-api/v1/owners/owner1/projects/proj1/issues/10': {
        body: { result: detail({ number: 10, id: 100, title: '새 이슈', body: 'src/a.ts:3' }) },
      },
    });

    const issue = await createIssue(client, 'owner1', 'proj1', '새 이슈', 'src/a.ts:3');

    assert.strictEqual(calls[0].method, 'POST');
    assert.deepStrictEqual(calls[0].body, { issues: [{ title: '새 이슈', body: 'src/a.ts:3' }] });
    assert.strictEqual(calls[1].url, '/-_-api/v1/owners/owner1/projects/proj1/issues/10');
    assert.strictEqual(issue.number, 10);
    assert.strictEqual(issue.title, '새 이슈');
    assert.strictEqual(issue.body, 'src/a.ts:3');
  });

  it('본문이 없으면 body 키를 보내지 않는다', async () => {
    const { calls, client } = routedFetch({
      'POST /-_-api/v1/owners/owner1/projects/proj1/issues': { status: 201, body: [{ status: 201, location: '/yona/owner1/proj1/issue/11#x' }] },
      'GET /-_-api/v1/owners/owner1/projects/proj1/issues/11': { body: { result: detail({ number: 11 }) } },
    });

    await createIssue(client, 'owner1', 'proj1', '제목만');

    assert.deepStrictEqual(calls[0].body, { issues: [{ title: '제목만' }] });
  });

  it('location에서 이슈 번호를 읽을 수 없으면 오류를 던진다', async () => {
    const { client } = routedFetch({
      'POST /-_-api/v1/owners/owner1/projects/proj1/issues': { status: 201, body: [{ status: 201, location: '/somewhere' }] },
    });

    await assert.rejects(() => createIssue(client, 'owner1', 'proj1', 't'), /번호/);
  });
});

describe('closeIssue, reopenIssue', () => {
  it('PATCH .../issues/{number}에 state closed를 보내고 result의 이슈를 반환한다', async () => {
    const { calls, client } = routedFetch({
      'PATCH /-_-api/v1/owners/owner1/projects/proj1/issues/5': { body: { result: detail({ state: 'CLOSED' }) } },
    });

    const issue = await closeIssue(client, 'owner1', 'proj1', 5);

    assert.strictEqual(calls[0].method, 'PATCH');
    assert.deepStrictEqual(calls[0].body, { state: 'closed' });
    assert.strictEqual(issue.state, 'CLOSED');
  });

  it('다시 열 때는 state open을 보낸다', async () => {
    const { calls, client } = routedFetch({
      'PATCH /-_-api/v1/owners/owner1/projects/proj1/issues/5': { body: { result: detail({ state: 'OPEN' }) } },
    });

    const issue = await reopenIssue(client, 'owner1', 'proj1', 5);

    assert.deepStrictEqual(calls[0].body, { state: 'open' });
    assert.strictEqual(issue.state, 'OPEN');
  });
});

describe('getIssueComments', () => {
  it('GET .../issues/{number}/comments를 호출하고 result의 댓글을 화면용으로 바꿔 반환한다', async () => {
    const { calls, client } = routedFetch({
      'GET /-_-api/v1/owners/owner1/projects/proj1/issues/5/comments': {
        body: {
          result: [
            { id: 1, type: 'ISSUE_COMMENT', author: user('admin', '관리자'), createdAt: '2026-11-17T10:10:00+0900', body: '첫 댓글' },
            { id: 2, type: 'ISSUE_COMMENT', author: user('bob', '밥'), createdAt: '2026-11-17T10:20:00+0900', body: '두번째 댓글' },
          ],
        },
      },
    });

    const comments = await getIssueComments(client, 'owner1', 'proj1', 5);

    assert.strictEqual(calls[0].url, '/-_-api/v1/owners/owner1/projects/proj1/issues/5/comments');
    assert.strictEqual(comments.length, 2);
    assert.strictEqual(comments[0].contents, '첫 댓글');
    assert.strictEqual(comments[0].authorLoginId, 'admin');
    assert.strictEqual(comments[0].authorName, '관리자');
    assert.strictEqual(comments[0].createdDate, '2026-11-17T10:10:00+0900');
    assert.strictEqual(comments[1].contents, '두번째 댓글');
  });

  it('한 줄 댓글(childComments)은 부모 바로 뒤에 펼치고 부모 번호를 담는다', async () => {
    const { client } = routedFetch({
      'GET /-_-api/v1/owners/owner1/projects/proj1/issues/5/comments': {
        body: {
          result: [
            { id: 1, type: 'ISSUE_COMMENT', author: user('admin', '관리자'), createdAt: 'a', body: '부모', childComments: [{ id: 3, type: 'ISSUE_COMMENT', author: user('bob', '밥'), createdAt: 'b', body: '답글' }] },
            { id: 2, type: 'ISSUE_COMMENT', author: user('bob', '밥'), createdAt: 'c', body: '다음 댓글' },
          ],
        },
      },
    });

    const comments = await getIssueComments(client, 'owner1', 'proj1', 5);

    assert.deepStrictEqual(comments.map((c) => c.contents), ['부모', '답글', '다음 댓글']);
    assert.strictEqual(comments[1].parentCommentId, 1);
    assert.strictEqual(comments[0].parentCommentId, undefined);
  });
});

describe('addIssueComment', () => {
  it('POST .../issues/{number}/comments에 comment로 보내고, 응답 이슈의 새 댓글(가장 큰 번호)을 반환한다', async () => {
    const { calls, client } = routedFetch({
      'POST /-_-api/v1/owners/owner1/projects/proj1/issues/5/comments': {
        status: 201,
        body: {
          result: detail({
            comments: [
              { id: 1, type: 'ISSUE_COMMENT', author: user('admin', '관리자'), createdAt: 'a', body: '예전 댓글' },
              { id: 9, type: 'ISSUE_COMMENT', author: user('bob', '밥'), createdAt: 'b', body: '새 댓글' },
            ],
          }),
        },
      },
    });

    const comment = await addIssueComment(client, 'owner1', 'proj1', 5, '새 댓글');

    assert.strictEqual(calls[0].method, 'POST');
    assert.deepStrictEqual(calls[0].body, { comment: '새 댓글' });
    assert.strictEqual(comment.id, 9);
    assert.strictEqual(comment.contents, '새 댓글');
    assert.strictEqual(comment.authorLoginId, 'bob');
  });

  it('응답에 댓글이 하나도 없으면 오류를 던진다', async () => {
    const { client } = routedFetch({
      'POST /-_-api/v1/owners/owner1/projects/proj1/issues/5/comments': { status: 201, body: { result: detail() } },
    });

    await assert.rejects(() => addIssueComment(client, 'owner1', 'proj1', 5, 'x'), /댓글/);
  });
});

describe('라벨', () => {
  it('목록 항목의 labels를 이름과 색으로 바꾼다', async () => {
    const { client } = routedFetch({
      'GET /-_-api/v1/owners/owner1/projects/proj1/issues?state=open': {
        body: { items: [summary({ labels: [{ id: 4, labelName: 'bug', labelColor: '#d73a4a', category: 'type' }] }), summary({ number: 2 })] },
      },
    });

    const [withLabel, without] = await getProjectIssues(client, 'owner1', 'proj1');

    assert.deepStrictEqual(withLabel.labels, [{ id: 4, name: 'bug', color: '#d73a4a', category: 'type' }]);
    assert.deepStrictEqual(without.labels, []);
  });

  it('상세의 labels도 같은 모양으로 바꾼다(번호는 없을 수 있다)', async () => {
    const { client } = routedFetch({
      'GET /-_-api/v1/owners/owner1/projects/proj1/issues/5': {
        body: { result: detail({ labels: [{ labelName: 'bug', labelColor: '#d73a4a', category: null }] }) },
      },
    });

    const issue = await getIssue(client, 'owner1', 'proj1', 5);

    assert.deepStrictEqual(issue.labels, [{ id: undefined, name: 'bug', color: '#d73a4a', category: undefined }]);
  });
});

describe('선택지 조회', () => {
  it('내가 속한 프로젝트를 소유자와 이름, 개요로 읽는다', async () => {
    const { calls, client } = routedFetch({
      'GET /-_-api/v1/user/projects': {
        body: { projects: [{ id: 1, owner: 'owner1', name: 'proj1', overview: '첫째', scope: 'PUBLIC' }, { id: 2, owner: 'org', name: 'web', overview: null }] },
      },
    });

    const projects = await getMyProjects(client);

    assert.strictEqual(calls[0].url, '/-_-api/v1/user/projects');
    assert.deepStrictEqual(projects, [
      { owner: 'owner1', name: 'proj1', overview: '첫째' },
      { owner: 'org', name: 'web', overview: undefined },
    ]);
  });

  it('담당자 후보를 로그인 ID와 이름으로 읽는다', async () => {
    const { calls, client } = routedFetch({
      'GET /-_-api/v1/owners/owner1/projects/proj1/assignableusers': { body: { users: [{ loginId: 'bob', name: '밥' }] } },
    });

    assert.deepStrictEqual(await getAssignableUsers(client, 'owner1', 'proj1'), [{ loginId: 'bob', name: '밥' }]);
    assert.strictEqual(calls[0].url, '/-_-api/v1/owners/owner1/projects/proj1/assignableusers');
  });

  it('라벨 목록을 번호, 이름, 색, 분류, 배타 여부로 읽는다', async () => {
    const { client } = routedFetch({
      'GET /-_-api/v1/owners/owner1/projects/proj1/labels': {
        body: { labels: [{ id: 4, labelName: 'bug', labelColor: '#d73a4a', category: 'type', categoryId: 1, isExclusive: true }] },
      },
    });

    assert.deepStrictEqual(await getLabels(client, 'owner1', 'proj1'), [
      { id: 4, name: 'bug', color: '#d73a4a', category: 'type', exclusive: true },
    ]);
  });

  it('열린 마일스톤을 번호, 제목, 기한 날짜로 읽는다', async () => {
    const { calls, client } = routedFetch({
      'GET /-_-api/v1/owners/owner1/projects/proj1/milestones?state=open': {
        body: { milestones: [{ id: 3, title: 'v1.0 출시', state: 'open', dueDate: '2026-12-31T23:59:59+0900' }, { id: 4, title: '미정', state: 'open', dueDate: '' }] },
      },
    });

    const milestones = await getMilestones(client, 'owner1', 'proj1');

    assert.strictEqual(calls[0].url, '/-_-api/v1/owners/owner1/projects/proj1/milestones?state=open');
    assert.deepStrictEqual(milestones, [
      { id: 3, title: 'v1.0 출시', dueDate: '2026-12-31' },
      { id: 4, title: '미정', dueDate: undefined },
    ]);
  });
});

describe('createIssue 옵션', () => {
  const created = {
    'POST /-_-api/v1/owners/owner1/projects/proj1/issues': { status: 201, body: [{ status: 201, location: '/owner1/proj1/issue/10' }] },
    'GET /-_-api/v1/owners/owner1/projects/proj1/issues/10': { body: { result: detail({ number: 10 }) } },
  };

  it('기한은 만들 때 함께 보내고, 담당자와 마일스톤과 라벨은 만든 뒤 PATCH로 붙인다', async () => {
    const { calls, client } = routedFetch({
      ...created,
      'PATCH /-_-api/v1/owners/owner1/projects/proj1/issues/10': { body: { result: detail({ number: 10 }) } },
    });

    await createIssue(client, 'owner1', 'proj1', '제목', '본문', { dueDate: '2026-11-20', assignee: 'bob', milestoneId: 3, labelIds: [4, 5] });

    assert.deepStrictEqual(calls.map((c) => c.method), ['POST', 'PATCH', 'GET']);
    const issue = (calls[0].body as { issues: Array<{ dueDate?: string }> }).issues[0];
    assert.ok(/^2026-11-20T23:59:59[+-]\d{2}:\d{2}$/.test(issue.dueDate ?? ''), `기한은 그날 23:59:59와 현지 시차로 보낸다: ${issue.dueDate}`);
    assert.deepStrictEqual(calls[1].body, { assignees: ['bob'], milestone: 3, labels: [4, 5] });
  });

  it('고른 것만 PATCH에 담고, 하나도 없으면 PATCH를 보내지 않는다', async () => {
    const only = routedFetch({
      ...created,
      'PATCH /-_-api/v1/owners/owner1/projects/proj1/issues/10': { body: { result: detail({ number: 10 }) } },
    });
    await createIssue(only.client, 'owner1', 'proj1', '제목', '', { assignee: 'bob' });
    assert.deepStrictEqual(only.calls[1].body, { assignees: ['bob'] });

    const none = routedFetch(created);
    await createIssue(none.client, 'owner1', 'proj1', '제목', '', {});
    assert.deepStrictEqual(none.calls.map((c) => c.method), ['POST', 'GET']);
  });
});

describe('createIssue 부분 실패', () => {
  it('만들기는 됐는데 PATCH가 실패하면 만든 이슈 번호를 담은 오류를 던진다', async () => {
    const { client } = routedFetch({
      'POST /-_-api/v1/owners/owner1/projects/proj1/issues': { status: 201, body: [{ status: 201, location: '/owner1/proj1/issue/10' }] },
      'PATCH /-_-api/v1/owners/owner1/projects/proj1/issues/10': { status: 400, body: { message: 'no user by request: nobody' } },
    });

    await assert.rejects(
      () => createIssue(client, 'owner1', 'proj1', '제목', '', { assignee: 'nobody' }),
      (err: unknown) => {
        assert.ok(err instanceof IssueCreatedPartiallyError);
        assert.strictEqual((err as IssueCreatedPartiallyError).number, 10);
        assert.ok((err as Error).message.includes('#10'));
        assert.ok((err as Error).message.includes('no user by request'));
        return true;
      },
    );
  });
});
