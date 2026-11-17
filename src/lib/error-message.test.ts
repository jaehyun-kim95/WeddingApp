import { getErrorMessage } from './error-message';

describe('getErrorMessage', () => {
  test('Error 인스턴스는 message를 그대로 반환', () => {
    expect(getErrorMessage(new Error('망했음'))).toBe('망했음');
  });

  test('PostgrestError({message,hint}) 모양의 일반 객체도 message+hint를 뽑아낸다', () => {
    // @supabase/postgrest-js가 fetch 자체가 거부될 때(네트워크/타임아웃) 반환하는 모양
    // (Error를 상속하지 않는 평범한 객체) — 2026-11-17 백업 복원 실기기 리포트로 발견.
    const e = { message: 'AbortError: fetch failed', details: '...', hint: 'Request was aborted (timeout or manual cancellation)', code: '' };
    expect(getErrorMessage(e)).toBe('AbortError: fetch failed (Request was aborted (timeout or manual cancellation))');
  });

  test('hint가 없으면 message만 반환(오탐 없이 불필요한 괄호 안 붙임)', () => {
    expect(getErrorMessage({ message: '단순 오류' })).toBe('단순 오류');
  });

  test('hint가 빈 문자열이면 괄호를 붙이지 않는다', () => {
    expect(getErrorMessage({ message: '단순 오류', hint: '' })).toBe('단순 오류');
  });

  // 병리 입력: message가 없거나 문자열이 아니거나, 완전히 다른 타입
  test.each([
    [null, '알 수 없는 오류가 발생했습니다.'],
    [undefined, '알 수 없는 오류가 발생했습니다.'],
    ['그냥 문자열', '알 수 없는 오류가 발생했습니다.'],
    [42, '알 수 없는 오류가 발생했습니다.'],
    [{}, '알 수 없는 오류가 발생했습니다.'],
    [{ message: 123 }, '알 수 없는 오류가 발생했습니다.'],
  ])('병리 입력 %p → 기본 문구', (input, expected) => {
    expect(getErrorMessage(input)).toBe(expected);
  });
});
