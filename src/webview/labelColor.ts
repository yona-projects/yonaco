/** 라벨 칩의 색을 다룬다. 서버가 준 색 문자열은 웹뷰의 스타일에 들어가므로 먼저 검사한다. */

const DEFAULT_COLOR = '#888888';

/** `#` 뒤 16진수 3자리나 6자리만 허용한다. 그 밖의 값(스타일 주입 시도 포함)은 기본 회색이다. */
export function safeColor(color: string): string {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color) ? color : DEFAULT_COLOR;
}

/** 배경색 위에서 잘 읽히는 글자색(검정이나 흰색)을 고른다. 밝기는 W3C 상대 휘도 근사식이다. */
export function labelTextColor(background: string): string {
  let hex = safeColor(background).slice(1);
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#000000' : '#ffffff';
}
