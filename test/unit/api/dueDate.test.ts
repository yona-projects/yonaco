import * as assert from 'assert';
import { describeDue, parseDueDate } from '../../../src/api/dueDate';

describe('parseDueDate', () => {
  it('목록의 ISO 형식에서 날짜만 읽는다', () => {
    assert.strictEqual(parseDueDate('2026-11-20T23:59:59+0900'), '2026-11-20');
  });

  it('상세의 긴 날짜 형식(영어 오전/오후)에서 날짜만 읽는다', () => {
    assert.strictEqual(parseDueDate('2026-11-20 PM 11:59:59 +0900'), '2026-11-20');
  });

  it('값이 없거나 빈 문자열이거나 날짜가 아니면 undefined이다', () => {
    assert.strictEqual(parseDueDate(undefined), undefined);
    assert.strictEqual(parseDueDate(''), undefined);
    assert.strictEqual(parseDueDate('내일'), undefined);
  });
});

describe('describeDue', () => {
  const now = new Date(2026, 10, 17, 15, 30); // 2026-11-17 오후 3시 30분(현지)

  it('기한이 없으면 undefined이다', () => {
    assert.strictEqual(describeDue(undefined, 'OPEN', now), undefined);
  });

  it('열린 이슈의 기한이 지났으면 N일 지남이고 overdue이다', () => {
    assert.deepStrictEqual(describeDue('2026-11-14', 'OPEN', now), { date: '2026-11-14', text: '3일 지남', status: 'overdue' });
  });

  it('기한이 오늘이면 오늘 마감이다', () => {
    assert.deepStrictEqual(describeDue('2026-11-17', 'OPEN', now), { date: '2026-11-17', text: '오늘 마감', status: 'today' });
  });

  it('기한이 남았으면 N일 남음이다', () => {
    assert.deepStrictEqual(describeDue('2026-11-20', 'OPEN', now), { date: '2026-11-20', text: '3일 남음', status: 'upcoming' });
  });

  it('닫힌 이슈는 기한이 지나도 지남으로 보지 않는다', () => {
    assert.deepStrictEqual(describeDue('2026-11-14', 'CLOSED', now), { date: '2026-11-14', text: '', status: 'none' });
  });

  it('달이 바뀌어도 일수를 맞게 센다', () => {
    assert.strictEqual(describeDue('2026-12-02', 'OPEN', now)?.text, '15일 남음');
  });
});
