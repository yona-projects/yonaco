# Yona 서버 API 요청사항 (yonaco Phase 0~4 대상)

`yonaco`(VS Code Extension) Phase 0~4를 구현하면서 `../yona` 서버 코드를 직접 확인한 결과, 클라이언트 구현만으로는 해결할 수 없는 서버 측 API 공백/결함을 정리한 문서다. 각 항목은 실제 소스 파일:라인을 근거로 확인했으며, "구현 가능"으로 분류된 나머지 기능은 이 문서에 포함하지 않는다(별도 클라이언트 구현 계획서 참고).

Phase 0/1 항목은 이미 실제로 부딪혀서 **클라이언트 쪽 우회 설계로 구현을 마친 것들**이고, Phase 2~4 항목은 아직 착수 전 사전 조사 단계에서 발견한 것들이다. 우회했다고 해서 요청 우선순위가 낮은 건 아니다 — 서버 API가 채워지면 우회 설계(수동 등록 등)를 걷어내고 더 나은 사용자 경험으로 바꿀 수 있다.

우선순위는 **P0(없으면 해당 기능을 아예 못 만듦) / P1(만들 수는 있지만 사용성이 크게 떨어짐) / P2(개선하면 좋음)**로 표기한다.

---

## 1. [P1, 이미 우회 구현함] 사용자 소속 프로젝트 목록 / 프로젝트ID→owner·name 조회 API 부재 — Phase 1

### 현재 상태
- `GET /api/v1/user/issues/status`(계정 전체 "내 이슈")가 주는 각 이슈에는 `projectId`(숫자 PK)만 있고 `owner`/프로젝트명이 없다.
- `ProjectRestApiController.kt`(`/api/v1/projects`)에는 `GET /{owner}`(특정 owner 밑 프로젝트 목록)와 `GET /{owner}/{project}`(단건) 두 엔드포인트뿐이다. **"owner를 모를 때 숫자 ID로 프로젝트를 찾는" 엔드포인트도, "로그인 사용자가 접근 가능한 프로젝트 전체를 나열하는" 엔드포인트도 없다.**
- 서버 내부에 `projectRepository.findByOwner(loginUser.loginId)`(`IssueViewController.kt:733,739`)가 있긴 하지만 이건 **본인이 owner인 프로젝트만** 찾고(멤버로 참여 중인 남의/조직 프로젝트는 제외), 게다가 HTML 사이드바 렌더링에만 쓰이는 내부 함수라 API로 노출되지 않는다.

### 왜 문제였나 (Phase 1에서 실제로 겪음)
0.1.1 구현 중 "내 이슈"를 프로젝트별로 그룹핑해서 보여주려 했는데, `projectId`만으로는 코멘트 작성 등에 필요한 `owner/project` URL을 만들 수 없었다. 결국 **사용자가 프로젝트를 "owner/name" 형식으로 직접 등록**하게 하는 `ProjectRegistry`로 우회했다(`yona.project.add` 커맨드). 동작은 하지만, 사용자가 자기 프로젝트 목록을 미리 다 알고 손으로 입력해야 하는 번거로움이 남아있다.

### 요청 사항
- `GET /api/v1/user/status` 또는 `/api/v1/user/issues/status`의 이슈 항목에 `projectOwner`/`projectName`(또는 owner/name을 포함하는 `project` 서브객체)을 추가 — 가장 간단한 해법.
- (대안/추가) `GET /api/v1/user/projects` 같은 "로그인 사용자가 접근 가능한 프로젝트 전체 목록"(본인 소유 + 멤버로 속한 프로젝트 모두) 계정 수준 엔드포인트. 이게 있으면 `yona.project.add` 수동 등록 없이 사용자의 프로젝트를 자동으로 나열해 선택하게 할 수 있다.

---

## 2. [P0] PR 코멘트/리뷰 스레드 전체 이력 조회 API 부재 — Phase 2 (착수 전)

### 현재 상태
- `PullRequestApiController.kt`(`/api/v1/projects/{owner}/{project}/pull-requests/{number}/comments`)는 **`POST`만 있고 `GET`이 없다**. 작성 시 응답으로 방금 만든 코멘트 하나(`PullRequestCommentResponse`)만 돌아온다.
- 라인/블록 단위 리뷰 코멘트(`ReviewViewController.kt`의 `POST /{owner}/{projectName}/pullRequest/{pullRequestId}/comments`)도 마찬가지로 생성만 가능하고, 특정 PR에 이미 달린 코멘트 스레드 목록을 JSON으로 돌려주는 엔드포인트가 없다.
- `ReviewThreadController.kt`(`GET /{owner}/{projectName}/reviews`)가 있긴 하지만 이건 프로젝트 전체의 리뷰 스레드를 모아 보여주는 **HTML 페이지(+ Excel export)**이고, 특정 PR 하나로 좁혀 JSON을 주는 API가 아니다.
- `ReviewCommentResponse` DTO(`RestApiResponseDto.kt`)는 이미 정의되어 있으나, 실제로 이걸 리스트로 반환하는 GET 컨트롤러 메서드를 찾지 못했다(생성 시점 용도로만 정의된 것으로 보임).

### 왜 문제인가
익스텐션이 PR 상세를 열었을 때 "지금까지 팀원들이 남긴 코멘트"를 diff 위에 보여줄 수가 없다. 새 코멘트를 추가하는 건 되지만, 리뷰어 입장에서 남이 이미 쓴 코멘트를 보지 못하면 코드 리뷰 도구로서 의미가 없다. **Phase 2의 "라인/블록 단위 리뷰 코멘트"(요나의 시그니처 기능)를 실사용 가능하게 만들려면 이게 없으면 안 된다.**

### 요청 사항
- `GET /api/v1/projects/{owner}/{project}/pull-requests/{number}/comments` — PR 전체 코멘트 목록(현재 POST 응답과 동일한 `PullRequestCommentResponse[]`)
- `GET /api/v1/projects/{owner}/{project}/pull-requests/{number}/review-comments`(또는 유사한 이름) — 해당 PR의 라인/블록 리뷰 코멘트 스레드 전체를 커밋ID/코드범위(`codeRange`)와 함께 반환. `CommentThread`/`CodeCommentThread` 도메인 모델과 `ReviewCommentResponse` DTO를 그대로 재사용할 수 있어 보임.
- 참고 패턴: 아래 4번 항목의 커밋 코멘트(`/api/vcs/.../commit/{id}/comments`)는 이미 GET/POST/DELETE 전체 CRUD가 있다 — 그 구현을 그대로 PR 코멘트에도 옮겨오면 될 것으로 보인다.

---

## 3. [해결됨] 이슈 코멘트 전체 이력 조회 API 부재 — Phase 1(이미 영향받음)/Phase 2 공통 패턴

### 해결 상태
서버에 `GET /api/v1/projects/{owner}/{project}/issues/{number}/comments`가 추가됐다
(`CommentController.getIssueComments()` + `IssueRestApiController.getComments()` 어댑터).
yonaco 클라이언트도 `getIssueComments()`를 추가해 이슈 상세 패널이 세션 로컬 코멘트가 아니라
서버의 전체 코멘트 이력을 보여주도록 이미 갱신했다. 아래는 해결 전 기록.

### 현재 상태(해결 전 기록)
- `IssueRestApiController.kt`의 `POST /{number}/comments`도 위와 동일하게 생성만 가능하고 GET이 없다(`CommentController.kt`에 create/update/delete만 존재).

### 왜 문제인가
이미 Phase 1(0.1.2)에서 이 문제로 "이번 세션에 작성한 코멘트만 표시" 하는 제약을 안고 구현했다(계획서 리스크 8번). Phase 2의 PR 코멘트도 똑같은 구조라 같이 요청하는 게 효율적이다.

### 요청 사항(해결 전 기록)
- `GET /api/v1/projects/{owner}/{project}/issues/{number}/comments`

---

## 4. [정보/패턴 참고] 커밋 코멘트는 이미 완전한 CRUD를 갖추고 있음

### 현재 상태 (요청 아님 — 참고용)
`CodeHistoryController.kt`의 `/api/vcs/{owner}/{project}/commit/{commitId}/comments`는 `POST`(생성)/`GET`(목록 조회)/`DELETE`(삭제)를 모두 갖추고 있고, `path`/`line`/`side` 필드로 **커밋의 특정 라인에 코멘트를 달 수 있다.** 위 2·3번 항목을 구현할 때 이 컨트롤러를 그대로 참고 패턴으로 쓰면 될 것 같다.

---

## 5. [P0] 브랜치 목록 JSON API 부재 — Phase 3

### 현재 상태
- `repository.getBranches()`를 호출하는 유일한 컨트롤러 메서드는 `BranchViewController.kt`의 `GET /{owner}/{projectName}/branches`이며, `@Controller`(JSON이 아니라 Thymeleaf HTML 풀페이지 렌더링)이다.
- `/api/vcs/{owner}/{project}/meta`는 특정 브랜치/경로의 파일트리 메타데이터만 주고 전체 브랜치 목록은 주지 않는다.
- `PullRequestViewController.kt`의 `branchNamesOf()`도 PR 생성 폼(`/pull/new`) 렌더링에만 쓰이는 내부 함수라 API로 노출되지 않는다.

### 왜 문제인가
- Phase 3의 "브랜치 관리"(기본설정/삭제)에서 대상 브랜치를 선택하는 UI를 만들 수 없다(어떤 브랜치들이 있는지 알 방법이 없음).
- 온라인 커밋(Phase 3)에서 "어느 브랜치에 커밋할지" 선택하는 UI도 마찬가지로 막힌다.

### 요청 사항
- `GET /api/v1/projects/{owner}/{project}/branches` (또는 `/api/vcs/{owner}/{project}/branches`) — 브랜치 이름 목록, 가능하면 기본 브랜치 표시(`isDefault` 등) 포함.

---

## 6. [P1] 온라인 커밋 실패 시 에러 신호 없음 — Phase 3

### 현재 상태
`BoardViewController.kt`의 `createPost()`(코드브라우저 "새 파일"/"편집" 처리 경로, `request.path`가 채워진 경우)는 커밋 실패 시:
```kotlin
try {
    bare.commitTextFile(branch, path, body, request.title)
} catch (e: Exception) {
    e.printStackTrace()
}
// ↓ 성공/실패 여부와 무관하게 항상 아래로 진행
return "redirect:/${owner}/${projectName}/..."
```
**예외를 서버 로그로만 남기고, 클라이언트에는 항상 (성공을 뜻하는) 302 리다이렉트를 돌려준다.**

### 왜 문제인가
익스텐션이 "커밋 성공"과 "커밋 실패(예: 충돌, 권한 문제, 잘못된 브랜치)"를 HTTP 응답만으로 구분할 수 없다. 실패해도 사용자에게는 "저장됐다"고 잘못 안내하게 된다.

### 요청 사항
- 커밋 실패 시 실패를 나타내는 상태코드(4xx/5xx) 또는 최소한 에러를 식별할 수 있는 리다이렉트 대상(예: `?error=commit_failed`)을 응답에 포함해달라.
- (더 근본적인 대안, P2) 코드브라우저 새 파일/편집 전용으로 `POST /api/v1/projects/{owner}/{project}/contents`류 v1 JSON 엔드포인트를 신설하면 이 문제와 "레거시 전권 토큰 필요" 문제를 동시에 해결할 수 있다.

---

## 7. [P1] 알림 읽음 처리 API 부재 — Phase 4

### 현재 상태
`NotificationController.kt`에는 `GET /api/notifications`만 있다. 읽음/안읽음 필드 자체가 응답(`NotificationResponse`)에 없고, 읽음으로 표시하는 엔드포인트도 없다.

### 왜 문제인가
익스텐션이 "새 알림"을 로컬에 기억한 마지막 ID/시각으로만 흉내낼 수 있고, 여러 기기(VS Code, 웹 브라우저 등)를 오가며 사용하면 읽음 상태가 서로 동기화되지 않는다.

### 요청 사항
- `NotificationResponse`에 `read: Boolean` 필드 추가
- `PATCH /api/notifications/{id}/read` 또는 `POST /api/notifications/read-all` 류 엔드포인트 추가

---

## 8. [P2] 알림 API의 인증 방식이 다른 v1 API와 다름 — Phase 4 (문서화 성격, 서버 동작 변경 요청은 아님)

### 현재 상태
`GET /api/notifications`는 `/api/v1/**` 네임스페이스가 아니라서 `ApiTokenAuthenticationFilter`의 스코프 판정을 안 타고 `authenticateLegacy()` 폴백(레거시 전권 토큰)으로만 인증된다. 다른 v1 리소스(이슈/PR 등)는 스코프 토큰으로 되는데 알림만 레거시 토큰이 필요해 사용자 경험이 일관되지 않다.

### 요청 사항 (선택)
- `/api/v1/user/issues/status`처럼 `/api/v1/user/notifications` 같은 계정 수준 v1 엔드포인트로 옮기고 스코프 토큰(예: `USERS` 그룹) 인가를 붙여주면 좋겠다. 필수는 아니고, 지금 상태로도 레거시 전권 토큰을 쓰면 동작은 한다.

---

## 요약 표

| # | 항목 | 우선순위 | 영향받는 Phase | 상태 |
|---|---|---|---|---|
| 1 | 프로젝트 목록/ID→owner·name 조회 API | P1 | Phase 1 | 이미 우회 구현함(수동 등록) |
| 2 | PR 코멘트/라인 리뷰 코멘트 GET API | P0 | Phase 2 | 착수 전 |
| 3 | 이슈 코멘트 GET API | P0 | Phase 1(이미 제약 있음)/2 | **해결됨** — 서버 API + yonaco 클라이언트 모두 반영 |
| 4 | (참고) 커밋 코멘트는 이미 완전함 | - | - | - |
| 5 | 브랜치 목록 JSON API | P0 | Phase 3 | 착수 전 |
| 6 | 온라인 커밋 실패 신호 부재 | P1 | Phase 3 | 착수 전 |
| 7 | 알림 읽음 처리 API | P1 | Phase 4 | 착수 전 |
| 8 | 알림 인증 방식 불일치 | P2 | Phase 4 | 착수 전 |
