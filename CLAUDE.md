# Design Readiness Checker

Figma 디자인 구조를 분석하여 개발 친화도와 AI 친화도를 점수와 리포트로 제공하는 CLI 도구

## Tech Stack

- **Runtime**: Node.js (>=18)
- **Language**: TypeScript (strict mode)
- **Package Manager**: pnpm
- **Validation**: zod
- **Testing**: vitest
- **CLI**: cac
- **Build**: tsup

## Project Structure

```
src/
├── core/           # 분석 엔진 및 핵심 로직
├── rules/          # 분석 규칙 정의
├── contracts/      # 타입 정의 및 Zod 스키마
├── cli/            # CLI 엔트리포인트
├── report-html/    # HTML 리포트 생성
└── adapters/       # 외부 서비스 연동 (Figma API 등)
```

## Commands

```bash
pnpm build          # 프로덕션 빌드
pnpm dev            # 개발 모드 (watch)
pnpm test           # 테스트 실행 (watch)
pnpm test:run       # 테스트 실행 (단일)
pnpm lint           # 타입 체크
```

## Conventions

### Code Style

- ESM 모듈 사용 (`import`/`export`)
- 상대 경로 import 시 `.js` 확장자 필수
- `@/*` 경로 별칭으로 `src/` 참조 가능

### TypeScript

- strict 모드 활성화
- `noUncheckedIndexedAccess` 활성화 - 배열/객체 접근 시 undefined 체크 필수
- `exactOptionalPropertyTypes` 활성화 - optional 프로퍼티에 undefined 명시적 할당 금지

### Zod

- 모든 외부 입력은 Zod 스키마로 검증
- 스키마 정의는 `contracts/` 디렉토리에 위치
- 스키마에서 TypeScript 타입 추론: `z.infer<typeof Schema>`

### Testing

- 테스트 파일은 소스 파일과 같은 위치에 `*.test.ts`로 생성
- describe/it/expect 글로벌 사용 가능 (vitest globals)

### Naming

- 파일명: kebab-case (`my-component.ts`)
- 타입/인터페이스: PascalCase (`MyInterface`)
- 함수/변수: camelCase (`myFunction`)
- 상수: SCREAMING_SNAKE_CASE (`MY_CONSTANT`)

### Git

- 커밋 메시지: conventional commits (feat, fix, docs, refactor, test, chore)
