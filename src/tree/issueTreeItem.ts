import { Issue } from '../api/types';

export interface ProjectGroupNode {
  type: 'project';
  owner: string;
  name: string;
}

export interface IssueNode {
  type: 'issue';
  owner: string;
  name: string;
  issue: Issue;
}

/** 프로젝트에 열린 이슈가 없을 때 보이는 안내 항목이다. */
export interface EmptyNode {
  type: 'empty';
  owner: string;
  name: string;
}

export type IssueTreeNode = ProjectGroupNode | IssueNode | EmptyNode;
