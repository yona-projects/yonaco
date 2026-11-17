/**
 * 이슈 기한을 다루는 도우미이다. 서버는 목록에서 `2026-11-20T23:59:59+0900`(ISO), 상세에서 `2026-11-20 PM 11:59:59 +0900`
 * (영어 오전/오후가 든 긴 날짜)을 주는데, 둘 다 앞의 `yyyy-MM-dd`가 서버 시간대의 날짜이다. 화면에는 날짜만 쓴다.
 */

/** 서버가 준 기한 문자열에서 `yyyy-MM-dd`를 읽는다. 값이 없거나 날짜가 아니면 `undefined`이다. */
export function parseDueDate(raw: string | undefined): string | undefined {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(raw ?? '');
  return match ? match[1] : undefined;
}

export type DueStatus = 'overdue' | 'today' | 'upcoming' | 'none';

export interface DueInfo {
  /** `yyyy-MM-dd` */
  date: string;
  /** "3일 지남", "오늘 마감", "3일 남음". 닫힌 이슈는 빈 문자열이다. */
  text: string;
  status: DueStatus;
}

function daysBetween(fromDate: string, toDate: string): number {
  const [fy, fm, fd] = fromDate.split('-').map(Number);
  const [ty, tm, td] = toDate.split('-').map(Number);
  // UTC 자정으로 맞춰 일광 절약 시간에 흔들리지 않게 센다.
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

function localDate(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** 기한의 상태를 구한다. 기한이 없으면 `undefined`이다. 닫힌 이슈는 날짜만 있고 지남이나 남음을 말하지 않는다. */
export function describeDue(dueDate: string | undefined, state: string, now: Date = new Date()): DueInfo | undefined {
  if (!dueDate) {
    return undefined;
  }
  if (state === 'CLOSED') {
    return { date: dueDate, text: '', status: 'none' };
  }
  const days = daysBetween(localDate(now), dueDate);
  if (days < 0) {
    return { date: dueDate, text: `${-days}일 지남`, status: 'overdue' };
  }
  if (days === 0) {
    return { date: dueDate, text: '오늘 마감', status: 'today' };
  }
  return { date: dueDate, text: `${days}일 남음`, status: 'upcoming' };
}
