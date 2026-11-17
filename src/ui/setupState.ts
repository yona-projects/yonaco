/** 사이드바 안내 화면이 단계별 버튼을 고르는 데 쓰는 설정 현황이다. */
export interface SetupInput {
  currentServer: string | undefined;
  hasToken: boolean;
  projectCount: number;
}

export interface SetupState {
  hasServer: boolean;
  hasToken: boolean;
  hasProject: boolean;
}

/** 서버, 토큰, 프로젝트 중 무엇이 준비되었는지 구한다. 토큰은 서버가 있어야 의미가 있으므로 서버가 없으면 거짓이다. */
export function describeSetupState(input: SetupInput): SetupState {
  const hasServer = input.currentServer !== undefined && input.currentServer !== '';
  return {
    hasServer,
    hasToken: hasServer && input.hasToken,
    hasProject: input.projectCount > 0,
  };
}
