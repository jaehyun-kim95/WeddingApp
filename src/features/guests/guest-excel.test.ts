import type { Guest } from '@/types/db';
import { buildGuestAoa, GUEST_EXCEL_HEADERS, parseGuestRows } from './guest-excel';

const guest = (id: string, extra: Partial<Guest> = {}): Guest => ({
  id, created_at: '', couple_id: 'c1', name: `하객${id}`, side: 'GROOM', relation: 'FRIEND',
  attend_status: 'ATTENDING', is_host: false, meal_count: 1, gift_amount: null, memo: null,
  ...extra,
});

describe('buildGuestAoa', () => {
  test('헤더행 + 하객당 1행, 축의금은 원 단위 raw(만원 변환 없음)', () => {
    const rows = buildGuestAoa([guest('a', { gift_amount: 50000 })]);
    expect(rows[0]).toEqual([...GUEST_EXCEL_HEADERS]);
    expect(rows[1]).toEqual(['하객a', '신랑 측', '친구', '참석', 1, 50000, '', '']);
  });

  test('혼주는 Y, gift_amount null/memo null은 공란', () => {
    const rows = buildGuestAoa([guest('b', { is_host: true, gift_amount: null, memo: null })]);
    expect(rows[1]).toEqual(['하객b', '신랑 측', '친구', '참석', 1, '', 'Y', '']);
  });

  test('0명이면 헤더행만', () => {
    expect(buildGuestAoa([])).toEqual([[...GUEST_EXCEL_HEADERS]]);
  });
});

describe('왕복 무손실(round-trip)', () => {
  test('buildGuestAoa → parseGuestRows가 원본 입력값을 복원한다', () => {
    const guests: Guest[] = [
      guest('a', {
        name: '김신랑', side: 'GROOM', relation: 'FAMILY', attend_status: 'ATTENDING',
        is_host: true, meal_count: 2, gift_amount: 100000, memo: '청첩장 전달함',
      }),
      guest('b', {
        name: '이신부', side: 'BRIDE', relation: 'WORK', attend_status: 'MAYBE',
        is_host: false, meal_count: 1, gift_amount: null, memo: null,
      }),
      guest('c', {
        name: '박지인', side: 'BRIDE', relation: 'ACQUAINTANCE', attend_status: 'ABSENT',
        is_host: false, meal_count: 0, gift_amount: 0, memo: null,
      }),
    ];
    const { valid, errors } = parseGuestRows(buildGuestAoa(guests));
    expect(errors).toEqual([]);
    expect(valid).toHaveLength(3);
    guests.forEach((g, i) => {
      expect(valid[i]).toEqual({
        name: g.name, side: g.side, relation: g.relation, attendStatus: g.attend_status,
        isHost: g.is_host, mealCount: g.meal_count, giftAmount: g.gift_amount, memo: g.memo,
      });
    });
  });

  test('큰 축의금 값도 정수로 보존', () => {
    const g = guest('big', { gift_amount: 5_000_000 });
    const { valid, errors } = parseGuestRows(buildGuestAoa([g]));
    expect(errors).toEqual([]);
    expect(valid[0].giftAmount).toBe(5_000_000);
  });
});

describe('parseGuestRows — 정상 케이스', () => {
  test('컬럼 순서가 달라도(헤더 기준 매핑) 정상 파싱', () => {
    const aoa = [
      ['메모', '이름', '측', '참석', '관계', '축의금', '식사인원', '혼주'],
      ['', '홍길동', '신부', '참석', '친구', 10000, 2, ''],
    ];
    const { valid, errors } = parseGuestRows(aoa);
    expect(errors).toEqual([]);
    expect(valid[0]).toEqual({
      name: '홍길동', side: 'BRIDE', relation: 'FRIEND', attendStatus: 'ATTENDING',
      isHost: false, mealCount: 2, giftAmount: 10000, memo: null,
    });
  });

  test('참석 공란 → MAYBE, 식사인원 공란 → 1, 축의금 공란 → null, 메모 공란 → null', () => {
    const aoa = [
      [...GUEST_EXCEL_HEADERS],
      ['홍길동', '신랑', '가족', '', '', '', '', ''],
    ];
    const { valid, errors } = parseGuestRows(aoa);
    expect(errors).toEqual([]);
    expect(valid[0]).toMatchObject({ attendStatus: 'MAYBE', mealCount: 1, giftAmount: null, memo: null });
  });

  test('영문 enum 값도 인식', () => {
    const aoa = [
      [...GUEST_EXCEL_HEADERS],
      ['John', 'GROOM', 'WORK', 'ATTENDING', 1, 0, '1', 'ok'],
    ];
    const { valid, errors } = parseGuestRows(aoa);
    expect(errors).toEqual([]);
    expect(valid[0]).toMatchObject({ side: 'GROOM', relation: 'WORK', attendStatus: 'ATTENDING', isHost: true });
  });

  test('혼주 인식값들(Y/예/true/TRUE/O/1)', () => {
    const rows = ['Y', '예', 'true', 'TRUE', 'O', '1'].map((v) => ['홍', '신랑', '가족', '참석', 1, '', v, '']);
    const aoa = [[...GUEST_EXCEL_HEADERS], ...rows];
    const { valid, errors } = parseGuestRows(aoa);
    expect(errors).toEqual([]);
    expect(valid.every((v) => v.isHost === true)).toBe(true);
  });
});

describe('parseGuestRows — 병리 입력', () => {
  test('0행(완전 빈 aoa)은 valid/errors 모두 빈 배열', () => {
    expect(parseGuestRows([])).toEqual({ valid: [], errors: [] });
  });

  test('헤더만 있고 데이터 행 없음(1행)', () => {
    expect(parseGuestRows([[...GUEST_EXCEL_HEADERS]])).toEqual({ valid: [], errors: [] });
  });

  test('빈 행(모든 셀 공백/null)은 skip — valid/errors 어디에도 없음', () => {
    const aoa = [
      [...GUEST_EXCEL_HEADERS],
      ['', '', '', '', '', '', '', ''],
      [null, null, null, null, null, null, null, null],
      ['   ', '', '', '', '', '', '', ''],
    ];
    expect(parseGuestRows(aoa)).toEqual({ valid: [], errors: [] });
  });

  test('후행 빈 행은 무시(마지막 유효 행 뒤에 공백 행들)', () => {
    const aoa = [
      [...GUEST_EXCEL_HEADERS],
      ['홍길동', '신랑', '가족', '참석', 1, '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
    ];
    const { valid, errors } = parseGuestRows(aoa);
    expect(valid).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  test('이름 누락', () => {
    const aoa = [[...GUEST_EXCEL_HEADERS], ['', '신랑', '가족', '참석', 1, '', '', '']];
    const { valid, errors } = parseGuestRows(aoa);
    expect(valid).toEqual([]);
    expect(errors).toEqual([{ row: 1, reason: '이름 누락' }]);
  });

  test('측 누락·깨진 enum', () => {
    const aoa = [
      [...GUEST_EXCEL_HEADERS],
      ['홍길동', '', '가족', '참석', 1, '', '', ''],
      ['김철수', 'XXXX', '가족', '참석', 1, '', '', ''],
    ];
    const { valid, errors } = parseGuestRows(aoa);
    expect(valid).toEqual([]);
    expect(errors).toEqual([
      { row: 1, reason: '측 누락' },
      { row: 2, reason: "측 값 인식 불가: 'XXXX'" },
    ]);
  });

  test('관계 깨진 enum', () => {
    const aoa = [[...GUEST_EXCEL_HEADERS], ['홍길동', '신랑', '없는관계', '참석', 1, '', '', '']];
    const { valid, errors } = parseGuestRows(aoa);
    expect(valid).toEqual([]);
    expect(errors).toEqual([{ row: 1, reason: "관계 값 인식 불가: '없는관계'" }]);
  });

  test('참석 값 인식 불가(공란이 아닌 깨진 값)', () => {
    const aoa = [[...GUEST_EXCEL_HEADERS], ['홍길동', '신랑', '가족', '강림', 1, '', '', '']];
    const { valid, errors } = parseGuestRows(aoa);
    expect(valid).toEqual([]);
    expect(errors).toEqual([{ row: 1, reason: "참석 값 인식 불가: '강림'" }]);
  });

  test('식사인원 비정수', () => {
    const aoa = [[...GUEST_EXCEL_HEADERS], ['홍길동', '신랑', '가족', '참석', '두명', '', '', '']];
    const { valid, errors } = parseGuestRows(aoa);
    expect(valid).toEqual([]);
    expect(errors).toEqual([{ row: 1, reason: "식사인원 값이 정수가 아님: '두명'" }]);
  });

  test('축의금 비숫자', () => {
    const aoa = [[...GUEST_EXCEL_HEADERS], ['홍길동', '신랑', '가족', '참석', 1, '오만원', '', '']];
    const { valid, errors } = parseGuestRows(aoa);
    expect(valid).toEqual([]);
    expect(errors).toEqual([{ row: 1, reason: "축의금 값이 숫자가 아님: '오만원'" }]);
  });

  test('공백만 있는 셀들은 공란과 동일하게 취급', () => {
    const aoa = [[...GUEST_EXCEL_HEADERS], ['홍길동', '신랑', '가족', '  ', 1, '  ', '  ', '  ']];
    const { valid, errors } = parseGuestRows(aoa);
    expect(errors).toEqual([]);
    expect(valid[0]).toMatchObject({ attendStatus: 'MAYBE', giftAmount: null, isHost: false, memo: null });
  });
});

describe('오탐 방지 — 이미 올바른 행은 건드리지 않는다', () => {
  test('유효한 다수 행은 전부 valid, errors 비어야 함', () => {
    const aoa = [
      [...GUEST_EXCEL_HEADERS],
      ['A', '신랑', '가족', '참석', 1, 10000, 'Y', '메모1'],
      ['B', '신부', '친구', '미정', 2, '', '', ''],
      ['C', '신랑', '직장', '불참', 1, 0, '', '메모3'],
    ];
    const { valid, errors } = parseGuestRows(aoa);
    expect(errors).toEqual([]);
    expect(valid).toHaveLength(3);
  });
});

describe('불변식', () => {
  const aoa = [
    [...GUEST_EXCEL_HEADERS],
    ['A', '신랑', '가족', '참석', 1, 10000, 'Y', ''],
    ['', '', '', '', '', '', '', ''],
    ['B', '', '가족', '참석', 1, '', '', ''], // 오류 행(측 누락)
  ];

  test('멱등성: 같은 aoa를 두 번 parse해도 동일 결과', () => {
    const r1 = parseGuestRows(aoa);
    const r2 = parseGuestRows(aoa);
    expect(r1).toEqual(r2);
  });

  test('보존성: 비어있지 않은 데이터행 수 = valid.length + errors.length', () => {
    const nonBlankRows = aoa.slice(1).filter((row) => row.some((c) => String(c ?? '').trim() !== ''));
    const { valid, errors } = parseGuestRows(aoa);
    expect(nonBlankRows.length).toBe(valid.length + errors.length);
  });
});
