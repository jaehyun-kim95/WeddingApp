// 에러에서 사람이 읽을 메시지를 최대한 뽑아낸다. Error 인스턴스뿐 아니라,
// @supabase/postgrest-js가 fetch 자체가 거부될 때(네트워크 끊김·타임아웃 등) 반환하는
// {message, details, hint, code} 모양의 일반 객체(Error를 상속하지 않는다 — 성공 응답을 받아
// 만드는 PostgrestError와 달리 fetch 실패 시의 catch 경로는 그냥 객체 리터럴을 돌려준다)도
// 처리한다. 2026-11-17 백업 복원 실기기 리포트에서 이 경로를 못 잡아 "알 수 없는 오류가
// 발생했습니다"만 보이던 문제로 발견했다. 어느 쪽도 아니면 기본 문구로 떨어진다.
export function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;

  if (typeof e === 'object' && e !== null && typeof (e as { message?: unknown }).message === 'string') {
    const { message, hint } = e as { message: string; hint?: unknown };
    return typeof hint === 'string' && hint.length > 0 ? `${message} (${hint})` : message;
  }

  return '알 수 없는 오류가 발생했습니다.';
}
