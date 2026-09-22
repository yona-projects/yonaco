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
