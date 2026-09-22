import * as assert from 'assert';
import { findIssueReferences } from '../../../src/scm/issueReferenceParser';

describe('findIssueReferences', () => {
  it('텍스트에서 "#숫자" 패턴을 모두 찾아 번호와 위치를 반환한다', () => {
    const refs = findIssueReferences('Fix #12 and #345 issues');

    assert.deepStrictEqual(refs, [
      { number: 12, start: 4, end: 7 },
      { number: 345, start: 12, end: 16 },
    ]);
  });

  it('"#" 뒤에 숫자가 없으면 매치하지 않는다', () => {
    assert.deepStrictEqual(findIssueReferences('hello #world'), []);
  });

  it('참조가 없으면 빈 배열을 반환한다', () => {
    assert.deepStrictEqual(findIssueReferences('no references here'), []);
  });
});
