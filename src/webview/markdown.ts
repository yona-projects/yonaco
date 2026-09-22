import { parse } from 'marked';

// marked는 raw HTML을 그대로 통과시킨다(별도 sanitize 옵션이 제거됨) — 이슈/코멘트 내용은
// 같은 서버의 다른 사용자가 작성한 것일 수 있어, 마크다운으로 해석시키기 전에 원문의 "<"와
// "&"만 이스케이프해 HTML 태그 자체가 만들어지지 않게 한다("<"가 없으면 태그를 열 수 없다).
// ">"는 그대로 둬 blockquote(">") 문법이 깨지지 않게 한다. 웹뷰 CSP(script-src에 nonce만
// 허용)가 스크립트 실행을 이중으로 막아준다.
function escapeForMarkdown(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

export function renderMarkdown(text: string): string {
  return parse(escapeForMarkdown(text), { async: false }) as string;
}
