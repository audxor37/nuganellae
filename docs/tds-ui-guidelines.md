# TDS UI Guidelines

이 문서는 누가낼래 WebView 앱의 UI를 TDS(Toss Design System) 방향에 맞게 유지하기 위한 기준이다.

## 기본 원칙

- 새 UI는 먼저 `@toss/tds-mobile` 컴포넌트로 표현할 수 있는지 확인한다.
- 커스텀 CSS는 레이아웃 보정, 앱 고유 표면, 반응형 안정성처럼 TDS 컴포넌트만으로 부족한 부분에 제한한다.
- 화면 구조, 액션, 상태 표현은 Toss 앱 안에서 익숙한 모바일 패턴을 우선한다.
- 한글 UI copy가 깨져 보이면 그 출력을 기준으로 편집하지 않는다. 정상 원문이나 신뢰 가능한 화면/문서 기준을 확인한 뒤 수정한다.

## Component Usage

- `Top`: 화면의 주요 제목과 설명에 사용한다. 제목 계층과 상하 여백은 `Top.TitleParagraph`, `Top.SubtitleParagraph`, `upperGap`, `lowerGap`으로 조정한다.
- `ListRow`: 목록, 설정 행, 정보 행의 기본 구조로 사용한다. `left`, `contents`, `right` 영역을 나누고, 오른쪽 영역에는 금액, 버튼, `Switch` 같은 액세서리를 배치한다.
- `Button` / `BottomCTA`: 사용자가 실행하는 명확한 액션에 사용한다. 화면 하단의 주요 다음 단계는 `BottomCTA.Single`을 우선한다.
- `SegmentedControl`: 여러 모드 중 하나를 선택할 때 사용한다.
- `Switch`: 켜짐/꺼짐 상태를 가진 설정에 사용한다. `checked`와 `onChange`로 controlled 상태를 유지하고, 외부 텍스트만으로 레이블이 충분하지 않으면 `aria-label`을 추가한다.

## Layout And Styling

- 고정 형식 카드, 요약 영역, 버튼 행은 `min-height`, `grid-template-columns`, `flex: 0 0 auto` 등으로 크기 축소와 텍스트 잘림을 방지한다.
- 텍스트가 들어가는 컴팩트 패널에서는 과도한 hero 크기 타이포그래피를 쓰지 않는다.
- 표면형 카드에는 충분한 대비를 가진 텍스트와 아이콘을 사용하고, 중요한 금액은 항상 한눈에 보이게 한다.
- 커스텀 아이콘 배경이나 카드 색은 CSS 변수(`--surface`, `--primary`, `--primary-fixed`, `--muted`, `--line`)를 우선 사용한다.

## Accessibility

- TDS 컴포넌트가 제공하는 role과 aria 상태를 유지한다.
- `Switch`는 `role="switch"`와 `aria-checked`가 전달되도록 공식 컴포넌트를 사용한다.
- 아이콘만 있는 버튼은 `aria-label` 또는 TDS 컴포넌트의 label prop으로 목적을 설명한다.
- 장식용 Material Symbols는 `aria-hidden="true"` 상태를 유지한다.

## Documentation Checks

- AppsInToss와 TDS 문서는 한국어 키워드로 먼저 검색한다.
- WebView 앱에서는 `@apps-in-toss/web-framework`와 `@toss/tds-mobile` 기준 문서를 우선한다.
- TDS 예제가 다른 패키지명을 쓰더라도 컴포넌트 API가 호환되는지 확인한 뒤 현재 프로젝트 패키지명으로 적용한다.
