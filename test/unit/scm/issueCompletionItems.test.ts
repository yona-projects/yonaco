import * as assert from 'assert';
import { buildIssueCompletionItems } from '../../../src/scm/issueCompletionItems';
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

describe('buildIssueCompletionItems', () => {
  it('각 이슈를 "#번호 제목" 라벨 + 번호 삽입텍스트 + owner/name detail로 변환한다', () => {
    const items = buildIssueCompletionItems([
      { owner: 'owner1', name: 'proj1', issue: fakeIssue({ number: 12, title: '버그 수정' }) },
    ]);

    assert.deepStrictEqual(items, [
      { label: '#12 버그 수정', insertText: '12', detail: 'owner1/proj1' },
    ]);
  });

  it('여러 프로젝트의 이슈를 모두 변환한다', () => {
    const items = buildIssueCompletionItems([
      { owner: 'a', name: 'p1', issue: fakeIssue({ number: 1, title: 'A' }) },
      { owner: 'b', name: 'p2', issue: fakeIssue({ number: 2, title: 'B' }) },
    ]);

    assert.strictEqual(items.length, 2);
    assert.strictEqual(items[1].label, '#2 B');
  });

  it('빈 목록이면 빈 배열을 반환한다', () => {
    assert.deepStrictEqual(buildIssueCompletionItems([]), []);
  });
});
