# VS Code Marketplace 배포 절차

## 이미 끝난 준비 (커밋됨)

- `package.json`에 마켓플레이스 필수/권장 필드 완비: `icon`, `repository`, `homepage`, `bugs`, `keywords`, `license`(Apache-2.0)
- `LICENSE`(Apache-2.0), `README.md` 작성
- `media/icon.png`(마켓플레이스 갤러리용), `media/activitybar-icon.png`(사이드바용) — yona-projects 로고 기반
- `vscode:prepublish` 스크립트 — `vsce package`/`publish` 실행 시 프로덕션 빌드를 자동으로 돌림
- `.vscodeignore` — 개발용 파일(`.claude/`, `out/`, 테스트 소스, 내부 문서)이 배포 패키지에 안 들어가게 막음
- `@vscode/vsce`를 devDependency로 추가

`npx vsce package`로 로컬 `.vsix` 생성까지는 이 저장소에서 검증됐다(경고/에러 없음, 유닛테스트 55개 통과).

## 남은 절차 (계정/인증이 필요해 여기서 대신할 수 없음)

### 1. Visual Studio Marketplace

1. [Azure DevOps](https://dev.azure.com)에 조직을 만들고, `package.json`의 `publisher`(`yonaprojects`)와 이름이 일치하는 퍼블리셔를 [marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage)에서 만든다(없으면 새로 생성).
2. Azure DevOps에서 **Marketplace (Publish)** 스코프를 가진 Personal Access Token(PAT)을 발급한다.
3. 로그인: `npx vsce login yonaprojects` (위 PAT 입력)
4. 배포: `npx vsce publish`
   - 처음 배포가 아니라 버전을 올리는 경우 `npx vsce publish patch`(또는 `minor`/`major`)로 버전 자동 증가 후 배포 가능.

### 2. Open VSX Registry (선택, VSCodium 등 비-MS 포크 지원용)

1. [open-vsx.org](https://open-vsx.org)에 GitHub 계정으로 로그인 후 Access Token 발급.
2. `npx ovsx publish -p <open-vsx-token>` (`ovsx` 패키지 추가 설치 필요: `npm install --save-dev ovsx`)

### 3. 배포 후 확인

- 마켓플레이스 페이지에서 README/아이콘/설명이 의도대로 보이는지 확인.
- 실제 VS Code에서 검색 설치해 활동 표시줄 아이콘·명령어가 정상 동작하는지 확인.

## 참고

- 로컬에서 미리 확인하려면 계정 없이 `npx vsce package` → 생성된 `.vsix`를 VS Code에서 "Install from VSIX..."로 사이드로드.
- 버전을 올릴 때는 `package.json`의 `version`을 SemVer 규칙에 맞게 손으로 올리거나 위 `vsce publish <bump>` 사용.
