// Deno 런타임 글로벌 타입 스텁 (타입 체크 전용).
// supabase/functions/*/logic.ts 는 tsconfig include 대상이라 tsc 가 타입 검사하지만,
// Deno 런타임 글로벌(Deno.env) 이 Node 환경에 정의되어 있지 않다.
// 런타임은 Deno 가 제공하며, index.ts 는 tsconfig exclude 대상이라 본 선언 없이 동작한다.
// SPEC-SECURITY-001: logic.ts 에서 Deno.env.get 사용.

declare global {
  // eslint-disable-next-line no-var
  var Deno: {
    env: {
      get(name: string): string | undefined;
    };
    serve(handler: (req: Request) => Response | Promise<Response>): void;
  };
}

export {};
