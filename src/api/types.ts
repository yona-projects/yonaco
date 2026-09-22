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
