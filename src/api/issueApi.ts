import { ApiClient } from './client';
import { ApiError } from './apiError';
import { parseDueDate } from './dueDate';
import { Issue, IssueAssignee, IssueComment, IssueLabel, LabelOption, MilestoneOption, ProjectInfo } from './types';

// Yona v2 서버의 외부 API(`/-_-api/v1`)를 부르고 화면 모델(types.ts)로 바꾼다. 서버 쪽 계약은 v2 저장소의
// `ExternalIssueApiController`, `ExternalProjectReadApiController`, `ExternalUserStatusApiController`와 응답을 만드는
// `IssueJson`, `ProjectJson.issueSummary`가 정한다.

interface RawLabel {
  id?: number;
  labelName: string;
  labelColor?: string;
  category?: string | null;
  isExclusive?: boolean;
}

interface RawPerson {
  loginId: string;
  name?: string;
  email?: string;
}

/** 목록 항목(`ProjectJson.issueSummary`)이다. 본문과 댓글은 없다. */
interface RawSummary {
  number: number;
  id: number;
  title: string;
  state: string;
  author?: RawPerson;
  assignees?: RawPerson[];
  milestone?: { id?: number; title?: string } | null;
  labels?: RawLabel[];
  dueDate?: string;
  numOfComments?: number;
  createdAt?: string;
  updatedAt?: string;
  url?: string;
}

interface RawComment {
  id: number;
  author?: RawPerson;
  createdAt?: string;
  body?: string;
  childComments?: RawComment[];
}

/** 이슈 상세(`IssueJson.of`)이다. 댓글은 오래된 순서이고 한 줄 댓글은 `childComments`로 묶여 있다. */
interface RawDetail {
  number: number;
  id: number;
  title: string;
  body?: string;
  state: string;
  author?: RawPerson;
  assignees?: RawPerson[];
  milestoneTitle?: string;
  labels?: RawLabel[];
  dueDate?: string;
  createdAt?: string;
  updatedAt?: string;
  owner?: string;
  projectName?: string;
  comments?: RawComment[];
}

function projectPath(owner: string, project: string): string {
  return `/-_-api/v1/owners/${encodeURIComponent(owner)}/projects/${encodeURIComponent(project)}`;
}

function toLabels(raws?: RawLabel[]): IssueLabel[] {
  return (raws ?? []).map((raw) => ({
    id: raw.id,
    name: raw.labelName,
    color: raw.labelColor ?? '',
    category: raw.category ?? undefined,
  }));
}

function toAssignee(people?: RawPerson[]): IssueAssignee | undefined {
  const first = people?.[0];
  return first ? { loginId: first.loginId, name: first.name ?? first.loginId } : undefined;
}

/**
 * 목록 항목의 `url`(`/소유자/프로젝트/issue/번호`, 앞에 컨텍스트 경로가 붙을 수 있다)에서 소유자와 프로젝트 이름을 읽는다.
 * 사용자 전체 현황(`/user/status`)의 항목에는 프로젝트 정보가 이 주소뿐이다.
 */
function ownerAndProjectFromUrl(url?: string): { owner?: string; project?: string } {
  if (!url) {
    return {};
  }
  const path = url.split(/[?#]/)[0];
  const parts = path.split('/').filter((part) => part.length > 0);
  if (parts.length < 4 || parts[parts.length - 2] !== 'issue') {
    return {};
  }
  return { owner: decodeURIComponent(parts[parts.length - 4]), project: decodeURIComponent(parts[parts.length - 3]) };
}

function fromSummary(raw: RawSummary, owner?: string, project?: string): Issue {
  const fromUrl = ownerAndProjectFromUrl(raw.url);
  return {
    id: raw.id,
    number: raw.number,
    title: raw.title,
    state: raw.state.toUpperCase(),
    projectOwner: owner ?? fromUrl.owner,
    projectName: project ?? fromUrl.project,
    authorLoginId: raw.author?.loginId ?? '',
    authorName: raw.author?.name,
    numOfComments: raw.numOfComments ?? 0,
    assignee: toAssignee(raw.assignees),
    milestone: raw.milestone?.title || undefined,
    labels: toLabels(raw.labels),
    dueDate: parseDueDate(raw.dueDate),
    createdDate: raw.createdAt,
    updatedDate: raw.updatedAt,
  };
}

function countComments(comments?: RawComment[]): number {
  return (comments ?? []).reduce((sum, comment) => sum + 1 + (comment.childComments?.length ?? 0), 0);
}

function fromDetail(raw: RawDetail): Issue {
  return {
    id: raw.id,
    number: raw.number,
    title: raw.title,
    body: raw.body,
    state: raw.state.toUpperCase(),
    projectOwner: raw.owner,
    projectName: raw.projectName,
    authorLoginId: raw.author?.loginId ?? '',
    authorName: raw.author?.name,
    numOfComments: countComments(raw.comments),
    assignee: toAssignee(raw.assignees),
    milestone: raw.milestoneTitle || undefined,
    labels: toLabels(raw.labels),
    dueDate: parseDueDate(raw.dueDate),
    createdDate: raw.createdAt,
    updatedDate: raw.updatedAt,
  };
}

function toComment(raw: RawComment, parentCommentId?: number): IssueComment {
  return {
    id: raw.id,
    contents: raw.body ?? '',
    authorLoginId: raw.author?.loginId ?? '',
    authorName: raw.author?.name,
    createdDate: raw.createdAt,
    parentCommentId,
  };
}

/** 댓글을 화면 순서로 펼친다: 부모 바로 뒤에 그 한 줄 댓글(답글)이 온다. */
function flattenComments(raws?: RawComment[]): IssueComment[] {
  const result: IssueComment[] = [];
  for (const raw of raws ?? []) {
    result.push(toComment(raw));
    for (const child of raw.childComments ?? []) {
      result.push(toComment(child, raw.id));
    }
  }
  return result;
}

export async function getMyAssignedIssues(client: ApiClient): Promise<Issue[]> {
  const response = await client.getJSON<{ assignedIssues: { items: RawSummary[] } }>('/-_-api/v1/user/status');
  return response.assignedIssues.items.map((item) => fromSummary(item));
}

export async function getProjectIssues(client: ApiClient, owner: string, project: string): Promise<Issue[]> {
  const page = await client.getJSON<{ items: RawSummary[] }>(`${projectPath(owner, project)}/issues?state=open`);
  return page.items.map((item) => fromSummary(item, owner, project));
}

export async function getIssue(client: ApiClient, owner: string, project: string, number: number): Promise<Issue> {
  const response = await client.getJSON<{ result: RawDetail }>(`${projectPath(owner, project)}/issues/${number}`);
  return fromDetail(response.result);
}

/** 이슈는 만들었지만 담당자, 마일스톤, 라벨을 붙이지 못했을 때의 오류이다. 만든 이슈의 번호를 담는다. */
export class IssueCreatedPartiallyError extends Error {
  constructor(
    readonly number: number,
    reason: string,
  ) {
    super(`이슈 #${number}은 만들었지만 담당자, 마일스톤, 라벨을 붙이지 못했습니다: ${reason}`);
    this.name = 'IssueCreatedPartiallyError';
  }
}

/** 이슈를 만들 때 고를 수 있는 선택 항목이다. */
export interface CreateIssueOptions {
  /** 기한 `yyyy-MM-dd`. 그날 23:59:59(이 컴퓨터의 시차)로 보낸다. */
  dueDate?: string;
  /** 담당자 로그인 ID. Yona의 이슈는 담당자가 한 명이다. */
  assignee?: string;
  milestoneId?: number;
  labelIds?: number[];
}

/** `2026-11-20`을 `2026-11-20T23:59:59+09:00`처럼 이 컴퓨터의 시차를 붙여 만든다. */
function endOfDay(date: string): string {
  const offset = -new Date(`${date}T12:00:00`).getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date}T23:59:59${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/**
 * 이슈를 만든다. 서버는 이슈 여러 개를 한 번에 받는 형식(`{"issues": [...]}`)이고 응답은 만든 이슈의 주소(`location`)뿐이다.
 * 기한은 만들 때 함께 보내지만, 담당자와 마일스톤과 라벨은 서버가 만들 때 받지 않으므로 만든 뒤 `PATCH`로 붙인다.
 * 마지막에 이슈를 다시 조회해 돌려준다.
 */
export async function createIssue(
  client: ApiClient,
  owner: string,
  project: string,
  title: string,
  body?: string,
  options: CreateIssueOptions = {},
): Promise<Issue> {
  const issue: { title: string; body?: string; dueDate?: string } = body === undefined ? { title } : { title, body };
  if (options.dueDate) {
    issue.dueDate = endOfDay(options.dueDate);
  }
  const created = await client.postJSON<Array<{ status: number; location?: string }>>(`${projectPath(owner, project)}/issues`, {
    issues: [issue],
  });
  const location = created[0]?.location ?? '';
  const match = /\/issue\/(\d+)/.exec(location);
  if (!match) {
    throw new Error(`만든 이슈의 번호를 알 수 없습니다: ${location}`);
  }
  const number = Number(match[1]);

  const patch: { assignees?: string[]; milestone?: number; labels?: number[] } = {};
  if (options.assignee) {
    patch.assignees = [options.assignee];
  }
  if (options.milestoneId !== undefined) {
    patch.milestone = options.milestoneId;
  }
  if (options.labelIds && options.labelIds.length > 0) {
    patch.labels = options.labelIds;
  }
  if (Object.keys(patch).length > 0) {
    try {
      await client.patchJSON(`${projectPath(owner, project)}/issues/${number}`, patch);
    } catch (err) {
      throw new IssueCreatedPartiallyError(number, err instanceof ApiError ? err.body : String(err));
    }
  }
  return getIssue(client, owner, project, number);
}

async function changeState(client: ApiClient, owner: string, project: string, number: number, state: 'open' | 'closed'): Promise<Issue> {
  const response = await client.patchJSON<{ result: RawDetail }>(`${projectPath(owner, project)}/issues/${number}`, { state });
  return fromDetail(response.result);
}

export function closeIssue(client: ApiClient, owner: string, project: string, number: number): Promise<Issue> {
  return changeState(client, owner, project, number, 'closed');
}

export function reopenIssue(client: ApiClient, owner: string, project: string, number: number): Promise<Issue> {
  return changeState(client, owner, project, number, 'open');
}

export async function getIssueComments(client: ApiClient, owner: string, project: string, number: number): Promise<IssueComment[]> {
  const response = await client.getJSON<{ result: RawComment[] }>(`${projectPath(owner, project)}/issues/${number}/comments`);
  return flattenComments(response.result);
}

/**
 * 댓글을 단다. 서버는 새 댓글이 아니라 댓글이 모두 담긴 이슈를 돌려주므로, 그 안에서 번호가 가장 큰 댓글(방금 단 것)을 돌려준다.
 */
export async function addIssueComment(
  client: ApiClient,
  owner: string,
  project: string,
  number: number,
  contents: string,
): Promise<IssueComment> {
  const response = await client.postJSON<{ result: RawDetail }>(`${projectPath(owner, project)}/issues/${number}/comments`, {
    comment: contents,
  });
  const all = flattenComments(response.result.comments);
  if (all.length === 0) {
    throw new Error('응답에서 방금 단 댓글을 찾을 수 없습니다');
  }
  return all.reduce((latest, comment) => (comment.id > latest.id ? comment : latest));
}

/** 토큰 주인이 구성원인 프로젝트이다. 프로젝트 등록 때 고르는 목록이다. */
export async function getMyProjects(client: ApiClient): Promise<ProjectInfo[]> {
  const response = await client.getJSON<{ projects: Array<{ owner: string; name: string; overview?: string | null }> }>(
    '/-_-api/v1/user/projects',
  );
  return response.projects.map((p) => ({ owner: p.owner, name: p.name, overview: p.overview ?? undefined }));
}

/** 담당자로 정할 수 있는 사람(프로젝트 구성원과 소속 조직의 구성원)이다. */
export async function getAssignableUsers(client: ApiClient, owner: string, project: string): Promise<IssueAssignee[]> {
  const response = await client.getJSON<{ users: Array<{ loginId: string; name?: string }> }>(
    `${projectPath(owner, project)}/assignableusers`,
  );
  return response.users.map((u) => ({ loginId: u.loginId, name: u.name ?? u.loginId }));
}

/** 프로젝트의 라벨이다(분류 이름, 라벨 이름 순서). */
export async function getLabels(client: ApiClient, owner: string, project: string): Promise<LabelOption[]> {
  const response = await client.getJSON<{ labels: Array<RawLabel & { id: number }> }>(`${projectPath(owner, project)}/labels`);
  return response.labels.map((l) => ({
    id: l.id,
    name: l.labelName,
    color: l.labelColor ?? '',
    category: l.category ?? undefined,
    exclusive: l.isExclusive === true,
  }));
}

/** 프로젝트의 열린 마일스톤이다. */
export async function getMilestones(client: ApiClient, owner: string, project: string): Promise<MilestoneOption[]> {
  const response = await client.getJSON<{ milestones: Array<{ id: number; title: string; dueDate?: string }> }>(
    `${projectPath(owner, project)}/milestones?state=open`,
  );
  return response.milestones.map((m) => ({ id: m.id, title: m.title, dueDate: parseDueDate(m.dueDate) }));
}
