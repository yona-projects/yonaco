/**
 * 사용자가 입력한 Yona 서버 주소를 검사하고 정리한다.
 * 컨텍스트 경로가 있는 설치(`https://host/yona`)도 허용하며, 끝의 슬래시는 뗀다.
 */

/** 주소로 쓸 수 없으면 사용자에게 보일 안내 문구를, 쓸 수 있으면 `undefined`를 돌려준다. */
export function validateServerUrl(input: string): string | undefined {
  const value = input.trim();
  if (!/^https?:\/\/[^\s/]+/i.test(value)) {
    return '주소는 http:// 또는 https:// 로 시작해야 합니다 (예: https://yona.example.com)';
  }
  return undefined;
}

/** 앞뒤 공백과 끝의 슬래시를 정리한 주소를 돌려준다. 쓸 수 없는 주소면 `undefined`이다. */
export function normalizeServerUrl(input: string): string | undefined {
  if (validateServerUrl(input) !== undefined) {
    return undefined;
  }
  return input.trim().replace(/\/+$/, '');
}
