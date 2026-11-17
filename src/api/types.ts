// 화면(트리, 상세 웹뷰, 커밋 메시지 자동완성)이 쓰는 모델이다. Yona v2 서버의 JSON을 그대로 쓰지 않고
// issueApi.ts가 이 모양으로 바꿔 준다(서버 응답이 바뀌어도 화면 코드는 건드리지 않게 하려는 것이다).

export interface IssueAssignee {
  loginId: string;
  name: string;
}

export interface IssueLabel {
  /** 라벨 번호. 이슈 상세 응답에는 없을 수 있다. */
  id?: number;
  name: string;
  /** `#d73a4a` 같은 색 */
  color: string;
  category?: string;
}

/** 선택지로 보이는 프로젝트 라벨이다(번호가 항상 있다). */
export interface LabelOption extends IssueLabel {
  id: number;
  /** 같은 분류에서 하나만 고를 수 있는 분류인지 */
  exclusive: boolean;
}

export interface MilestoneOption {
  id: number;
  title: string;
  /** `yyyy-MM-dd` */
  dueDate?: string;
}

export interface ProjectInfo {
  owner: string;
  name: string;
  overview?: string;
}

export interface Issue {
  id: number;
  number: number;
  title: string;
  body?: string;
  // 화면은 OPEN과 CLOSED로 다룬다. 서버의 목록은 소문자(open, closed), 상세는 대문자라 어댑터가 맞춘다.
  state: string;
  // 소유자와 프로젝트 이름. 목록 항목은 요청 주소나 항목의 url에서, 상세는 응답의 owner와 projectName에서 얻는다.
  projectOwner?: string;
  projectName?: string;
  authorLoginId: string;
  authorName?: string;
  // 목록은 서버가 주는 값이고, 상세는 응답의 댓글(답글 포함)을 세어 채운다.
  numOfComments: number;
  assignee?: IssueAssignee;
  /** 마일스톤 제목 */
  milestone?: string;
  /** 기한, `yyyy-MM-dd` */
  dueDate?: string;
  labels?: IssueLabel[];
  createdDate?: string;
  updatedDate?: string;
}

export interface IssueComment {
  id: number;
  contents: string;
  authorLoginId: string;
  authorName?: string;
  createdDate?: string;
  // 한 줄 댓글(답글)이면 부모 댓글의 번호이다.
  parentCommentId?: number;
}
