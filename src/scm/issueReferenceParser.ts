export interface IssueReference {
  number: number;
  start: number;
  end: number;
}

const ISSUE_REFERENCE_PATTERN = /#(\d+)/g;

export function findIssueReferences(text: string): IssueReference[] {
  const refs: IssueReference[] = [];
  const pattern = new RegExp(ISSUE_REFERENCE_PATTERN);
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    refs.push({ number: parseInt(match[1], 10), start: match.index, end: match.index + match[0].length });
  }
  return refs;
}
