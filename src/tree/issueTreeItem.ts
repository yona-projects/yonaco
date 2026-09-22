import { Issue } from '../api/types';

export interface ProjectGroupNode {
  type: 'project';
  projectId: number;
  issueCount: number;
}

export interface IssueNode {
  type: 'issue';
  issue: Issue;
}

export type IssueTreeNode = ProjectGroupNode | IssueNode;
