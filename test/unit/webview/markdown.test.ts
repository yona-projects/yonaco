import * as assert from 'assert';
import { renderMarkdown } from '../../../src/webview/markdown';

describe('renderMarkdown', () => {
  it('굵게/기울임 마크다운 문법을 HTML로 변환한다', () => {
    const html = renderMarkdown('**굵게** 그리고 *기울임*');
    assert.ok(html.includes('<strong>굵게</strong>'));
    assert.ok(html.includes('<em>기울임</em>'));
  });

  it('코드 블록을 <pre><code>로 변환한다', () => {
    const html = renderMarkdown('```\nconst a = 1;\n```');
    assert.ok(html.includes('<pre>'));
    assert.ok(html.includes('const a = 1;'));
  });

  it('평문 텍스트의 내용은 그대로 보존한다', () => {
    const html = renderMarkdown('테스트 코멘트');
    assert.ok(html.includes('테스트 코멘트'));
  });

  it('원문에 있는 <script> 같은 raw HTML 태그는 실행 가능한 태그로 렌더링되지 않는다', () => {
    const html = renderMarkdown('<script>alert(1)</script>');
    assert.ok(!html.includes('<script>'));
  });

  it('원문에 있는 이미지 onerror 같은 이벤트 핸들러 속성도 태그로 렌더링되지 않는다', () => {
    const html = renderMarkdown('<img src=x onerror="alert(1)">');
    assert.ok(!html.includes('<img'));
  });

  it('한 번의 줄바꿈(Enter 한 번)도 <br>로 표시돼야 한다(GitHub 이슈/코멘트와 동일한 관례)', () => {
    const html = renderMarkdown('첫줄\n둘째줄');
    assert.ok(html.includes('첫줄<br>둘째줄'));
  });
});
