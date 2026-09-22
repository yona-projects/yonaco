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

export type IssueTreeNode = ProjectGroupNode | IssueNode;
