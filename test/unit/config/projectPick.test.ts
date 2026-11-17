import * as assert from 'assert';
import { MANUAL_ENTRY_LABEL, projectPickItems } from '../../../src/config/projectPick';

describe('projectPickItems', () => {
  const mine = [
    { owner: 'owner1', name: 'proj1', overview: '첫째' },
    { owner: 'org', name: 'web' },
    { owner: 'owner1', name: 'proj2', overview: '둘째' },
  ];

  it('이미 등록한 프로젝트는 빼고 owner/name 라벨과 개요 설명으로 항목을 만든다', () => {
    const items = projectPickItems(mine, [{ owner: 'owner1', name: 'proj1' }]);

    assert.deepStrictEqual(
      items.filter((i) => i.ref).map((i) => [i.label, i.description]),
      [
        ['org/web', undefined],
        ['owner1/proj2', '둘째'],
      ],
    );
  });

  it('맨 끝에 직접 입력 항목이 있고 프로젝트 정보는 없다', () => {
    const items = projectPickItems(mine, []);

    const last = items[items.length - 1];
    assert.strictEqual(last.label, MANUAL_ENTRY_LABEL);
    assert.strictEqual(last.ref, undefined);
  });

  it('고를 프로젝트가 하나도 없으면 빈 배열이다(직접 입력 안내로 넘어간다)', () => {
    assert.deepStrictEqual(projectPickItems(mine, mine), []);
    assert.deepStrictEqual(projectPickItems([], []), []);
  });
});
