import * as assert from 'assert';
import { issueWebUrl, projectWebUrl } from '../../../src/api/webUrls';

describe('webUrls', () => {
  it('프로젝트 화면 주소는 서버 주소 뒤에 소유자와 프로젝트 이름이 온다', () => {
    assert.strictEqual(projectWebUrl('https://yona.example.com', 'owner1', 'proj1'), 'https://yona.example.com/owner1/proj1');
  });

  it('이슈 화면 주소는 /소유자/프로젝트/issue/번호이다', () => {
    assert.strictEqual(issueWebUrl('https://yona.example.com', 'owner1', 'proj1', 12), 'https://yona.example.com/owner1/proj1/issue/12');
  });

  it('서버 주소 끝의 슬래시와 컨텍스트 경로를 처리하고 한글 이름은 인코딩한다', () => {
    assert.strictEqual(issueWebUrl('https://host/yona/', '소유자', '내 프로젝트', 3), 'https://host/yona/%EC%86%8C%EC%9C%A0%EC%9E%90/%EB%82%B4%20%ED%94%84%EB%A1%9C%EC%A0%9D%ED%8A%B8/issue/3');
  });
});
