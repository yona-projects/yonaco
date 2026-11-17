/** 서버의 웹 화면 주소를 만든다. 확장에서 "브라우저에서 열기"가 쓴다. 컨텍스트 경로가 있는 서버 주소(`https://host/yona`)도 맞다. */

function base(serverUrl: string): string {
  return serverUrl.replace(/\/+$/, '');
}

/** 프로젝트 홈 화면 주소이다. */
export function projectWebUrl(serverUrl: string, owner: string, project: string): string {
  return `${base(serverUrl)}/${encodeURIComponent(owner)}/${encodeURIComponent(project)}`;
}

/** 이슈 상세 화면 주소이다. */
export function issueWebUrl(serverUrl: string, owner: string, project: string, number: number): string {
  return `${projectWebUrl(serverUrl, owner, project)}/issue/${number}`;
}
