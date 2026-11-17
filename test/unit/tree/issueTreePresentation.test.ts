import * as assert from 'assert';
import { describeIssueItem } from '../../../src/tree/issueTreePresentation';
import { Issue } from '../../../src/api/types';

function issue(overrides: Partial<Issue>): Issue {
  return { id: 1, number: 7, title: '제목', state: 'OPEN', authorLoginId: 'admin', numOfComments: 0, ...overrides };
}

describe('describeIssueItem', () => {
  it('라벨은 "#번호 제목"이다', () => {
    assert.strictEqual(describeIssueItem(issue({})).label, '#7 제목');
  });

  it('설명에는 담당자를 먼저, 없으면 작성자를 보이고 댓글이 있으면 댓글 수를 덧붙인다', () => {
    assert.strictEqual(describeIssueItem(issue({})).description, 'admin');
    assert.strictEqual(
      describeIssueItem(issue({ assignee: { loginId: 'bob', name: '밥' }, numOfComments: 3 })).description,
      '밥 · 댓글 3',
    );
    assert.strictEqual(describeIssueItem(issue({ numOfComments: 2 })).description, 'admin · 댓글 2');
  });

  it('툴팁에는 제목과 상태, 작성자, 담당자, 댓글 수, 갱신 시각이 줄바꿈으로 담긴다', () => {
    const tip = describeIssueItem(
      issue({ authorName: '관리자', assignee: { loginId: 'bob', name: '밥' }, numOfComments: 3, updatedDate: '2026-11-17T11:00:00+0900' }),
    ).tooltip;
    assert.ok(tip.includes('#7 제목'));
    assert.ok(tip.includes('상태: 열림'));
    assert.ok(tip.includes('작성자: 관리자'));
    assert.ok(tip.includes('담당자: 밥'));
    assert.ok(tip.includes('댓글: 3'));
    assert.ok(tip.includes('갱신: 2026-11-17T11:00:00+0900'));
  });

  it('닫힌 이슈의 툴팁은 상태가 닫힘이다', () => {
    assert.ok(describeIssueItem(issue({ state: 'CLOSED' })).tooltip.includes('상태: 닫힘'));
  });

  it('툴팁에 마일스톤과 기한이 있고, 기한이 지났으면 지남을 덧붙인다', () => {
    const now = new Date(2026, 10, 17, 12, 0);
    const tip = describeIssueItem(issue({ milestone: 'v1.0 출시', dueDate: '2026-11-14' }), now).tooltip;
    assert.ok(tip.includes('마일스톤: v1.0 출시'));
    assert.ok(tip.includes('기한: 2026-11-14 (3일 지남)'));
  });

  it('설명에 기한을 월-일로 보이고, 지났으면 지남을 붙인다', () => {
    const now = new Date(2026, 10, 17, 12, 0);
    assert.strictEqual(describeIssueItem(issue({ dueDate: '2026-11-20' }), now).description, 'admin · 기한 11-20');
    assert.strictEqual(describeIssueItem(issue({ dueDate: '2026-11-14' }), now).description, 'admin · 기한 11-14 지남');
  });

  it('닫힌 이슈는 기한을 설명에 보이지 않는다', () => {
    const now = new Date(2026, 10, 17, 12, 0);
    assert.strictEqual(describeIssueItem(issue({ state: 'CLOSED', dueDate: '2026-11-14' }), now).description, 'admin');
  });

  it('툴팁에 라벨 이름이 쉼표로 이어진다', () => {
    const tip = describeIssueItem(
      issue({ labels: [{ name: 'bug', color: '#d73a4a' }, { name: 'ui', color: '#0075ca' }] }),
    ).tooltip;
    assert.ok(tip.includes('라벨: bug, ui'));
    assert.ok(!describeIssueItem(issue({})).tooltip.includes('라벨'), '라벨이 없으면 줄이 없다');
  });
});
