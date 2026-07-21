---
name: pen-reference-open-first
description: sagak UI 작업 시 반드시 Pencil MCP batch_get으로 .pen 화면 노드를 먼저 열람한 뒤 코드를 작성할 것
metadata:
  type: feedback
---

sagak 프로젝트에서 UI 화면/컴포넌트를 구현할 때, Pencil MCP `.moai/design/sagak.pen`의 해당 화면 노드를 `batch_get`(readDepth 4)으로 먼저 열람한 뒤 코드를 작성한다. `get_variables`로 토큰값도 함께 확인한다.

**Why:** SPEC-CLUB-002 M4 구현 시 사용자가 lessons #9로 지정한 핵심 요구사항. CLUB-001 trackA 구현 시 이 단계가 누락되어 디자인과 코드가 어긋났었다. .pen의 구체적 구조(Header/Content/카드 패딩/아이콘 색상 등)를 batch_get으로 확인해야 토큰과 레이아웃이 정확히 반영된다.

**How to apply:** UI 화면 작업 시작 시 첫 번째 단계로 batch_get 실행. 노드 ID를 모르면 부모부터 readDepth 1로 탐색 후 하위 ID 확장. 텍스트 요약에만 의존하지 말고 fontSize/fontWeight/fill/padding/cornerRadius/gap 값을 직접 읽고 그대로 코드에 매핑. 관련: [[design-tool-pencil-not-stitch]]
