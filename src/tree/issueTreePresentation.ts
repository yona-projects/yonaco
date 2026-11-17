import { Issue } from '../api/types';
import { describeDue } from '../api/dueDate';

/** 트리의 이슈 항목에 보일 글이다. `vscode`에 기대지 않아 단위 시험이 가능하다. */
export interface IssueItemText {
  label: string;
  /** 라벨 오른쪽의 흐린 글: 담당자(없으면 작성자)와 댓글 수 */
  description: string;
  /** 마우스를 올리면 보이는 여러 줄 설명 */
  tooltip: string;
}

export function describeIssueItem(issue: Issue, now: Date = new Date()): IssueItemText {
  const who = issue.assignee?.name ?? issue.authorLoginId;
  const due = describeDue(issue.dueDate, issue.state, now);
  const parts = [who];
  if (issue.numOfComments > 0) {
    parts.push(`댓글 ${issue.numOfComments}`);
  }
  // 닫힌 이슈의 기한은 더 의미가 없으므로 설명 줄에는 열린 이슈만 보인다.
  if (due && due.status !== 'none') {
    parts.push(`기한 ${due.date.slice(5)}${due.status === 'overdue' ? ' 지남' : ''}`);
  }
  const description = parts.join(' · ');

  const lines = [`#${issue.number} ${issue.title}`, `상태: ${issue.state === 'CLOSED' ? '닫힘' : '열림'}`];
  lines.push(`작성자: ${issue.authorName ?? issue.authorLoginId}`);
  if (issue.assignee) {
    lines.push(`담당자: ${issue.assignee.name}`);
  }
  if (issue.milestone) {
    lines.push(`마일스톤: ${issue.milestone}`);
  }
  if (issue.labels && issue.labels.length > 0) {
    lines.push(`라벨: ${issue.labels.map((label) => label.name).join(', ')}`);
  }
  if (due) {
    lines.push(`기한: ${due.date}${due.text ? ` (${due.text})` : ''}`);
  }
  lines.push(`댓글: ${issue.numOfComments}`);
  if (issue.updatedDate) {
    lines.push(`갱신: ${issue.updatedDate}`);
  }

  return { label: `#${issue.number} ${issue.title}`, description, tooltip: lines.join('\n') };
}
