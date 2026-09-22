export interface IssueAssignee {
  id: number;
  userId: number;
  loginId: string;
  name: string;
}

export interface Issue {
  id: number;
  number: number;
  title: string;
  body?: string;
  state: string;
  projectId: number;
  // 서버가 2026-09-22부터 내려주기 시작한 필드(yona-projects/yona 커밋 a7ff97902) — 계정 전체
  // 이슈 집계(/api/v1/user/issues/status)처럼 projectId만 있던 응답에서도 owner/name을
  // 바로 알 수 있게 됐다. 옵셔널로 두는 이유: 구버전 서버는 이 필드를 안 내려줄 수 있음.
  projectOwner?: string;
  projectName?: string;
  authorLoginId: string;
  authorName?: string;
  numOfComments: number;
  assignee?: IssueAssignee;
  createdDate?: string;
  updatedDate?: string;
}

export interface IssueStatusSection {
  openCount: number;
  closedCount: number;
  items: Issue[];
}

export interface IssueComment {
  id: number;
  contents: string;
  authorLoginId: string;
  authorName?: string;
  createdDate?: string;
  parentCommentId?: number;
  issueId: number;
}

export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}
