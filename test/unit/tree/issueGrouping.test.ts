import * as assert from 'assert';
import { groupIssuesByProject } from '../../../src/tree/issueGrouping';
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

describe('groupIssuesByProject', () => {
  it('projectId별로 이슈를 묶어 그룹 배열을 반환한다', () => {
    const issues = [
      fakeIssue({ id: 1, projectId: 10, title: 'A' }),
      fakeIssue({ id: 2, projectId: 20, title: 'B' }),
      fakeIssue({ id: 3, projectId: 10, title: 'C' }),
    ];

    const groups = groupIssuesByProject(issues);

    assert.strictEqual(groups.length, 2);
    const group10 = groups.find((g) => g.projectId === 10);
    const group20 = groups.find((g) => g.projectId === 20);
    assert.strictEqual(group10?.issues.length, 2);
    assert.deepStrictEqual(
      group10?.issues.map((i) => i.title),
      ['A', 'C'],
    );
    assert.strictEqual(group20?.issues.length, 1);
  });

  it('projectId 오름차순으로 그룹을 정렬한다', () => {
    const issues = [fakeIssue({ projectId: 30 }), fakeIssue({ projectId: 10 }), fakeIssue({ projectId: 20 })];

    const groups = groupIssuesByProject(issues);

    assert.deepStrictEqual(
      groups.map((g) => g.projectId),
      [10, 20, 30],
    );
  });

  it('이슈가 없으면 빈 배열을 반환한다', () => {
    assert.deepStrictEqual(groupIssuesByProject([]), []);
  });
});
