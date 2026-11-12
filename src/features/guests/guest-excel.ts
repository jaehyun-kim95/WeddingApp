import type { AttendStatus, Guest, GuestRelation, GuestSide } from '@/types/db';
import { ATTEND_LABEL, RELATION_LABEL, SIDE_LABEL, type ImportGuestRow } from './api';
import type { RowError } from './types';

// 순수 변환 전용(RN/xlsx import 절대 금지). 엑셀 시트 ↔ 2차원 배열(aoa)의 코어 로직만 담는다.
// 실제 XLSX 파일 I/O는 상위 글루 레이어(화면/서비스)가 처리한다.

export const GUEST_EXCEL_HEADERS = ['이름', '측', '관계', '참석', '식사인원', '축의금', '혼주', '메모'] as const;
type Header = (typeof GUEST_EXCEL_HEADERS)[number];

type Cell = string | number | null | undefined;

// 셀 → trim된 문자열. null/undefined는 빈 문자열(= '공란').
function cellText(cell: Cell): string {
  if (cell === null || cell === undefined) return '';
  return String(cell).trim();
}

function normSide(text: string): GuestSide | null {
  if (!text) return null;
  if (text === '신랑' || text === '신랑측' || text === '신랑 측') return 'GROOM';
  if (text === '신부' || text === '신부측' || text === '신부 측') return 'BRIDE';
  const upper = text.toUpperCase();
  if (upper === 'GROOM') return 'GROOM';
  if (upper === 'BRIDE') return 'BRIDE';
  return null;
}

const RELATION_KO: Record<string, GuestRelation> = {
  가족: 'FAMILY', 친구: 'FRIEND', 직장: 'WORK', 지인: 'ACQUAINTANCE',
};
function normRelation(text: string): GuestRelation | null {
  if (!text) return null;
  if (RELATION_KO[text]) return RELATION_KO[text];
  const upper = text.toUpperCase();
  if (upper === 'FAMILY' || upper === 'FRIEND' || upper === 'WORK' || upper === 'ACQUAINTANCE') {
    return upper as GuestRelation;
  }
  return null;
}

const ATTEND_KO: Record<string, AttendStatus> = {
  참석: 'ATTENDING', 미정: 'MAYBE', 불참: 'ABSENT',
};
function normAttend(text: string): AttendStatus | null {
  if (!text) return null;
  if (ATTEND_KO[text]) return ATTEND_KO[text];
  const upper = text.toUpperCase();
  if (upper === 'ATTENDING' || upper === 'MAYBE' || upper === 'ABSENT') return upper as AttendStatus;
  return null;
}

const HOST_TRUE_VALUES = new Set(['Y', '예', 'true', 'TRUE', 'O', '1']);
function normIsHost(text: string): boolean {
  return HOST_TRUE_VALUES.has(text);
}

// 읽기: Guest[] → 헤더행 + 하객당 1행. 축의금은 원 단위 정수 raw(왕복 무손실 — 만원 변환 없음).
export function buildGuestAoa(guests: Guest[]): (string | number)[][] {
  const rows: (string | number)[][] = [[...GUEST_EXCEL_HEADERS]];
  for (const g of guests) {
    rows.push([
      g.name,
      SIDE_LABEL[g.side],
      RELATION_LABEL[g.relation],
      ATTEND_LABEL[g.attend_status],
      g.meal_count,
      g.gift_amount ?? '',
      g.is_host ? 'Y' : '',
      g.memo ?? '',
    ]);
  }
  return rows;
}

// 쓰기: aoa → 유효 행 + 오류 행. 첫 행=헤더(순서 유연, trim 비교로 컬럼 인덱스 매핑).
export function parseGuestRows(aoa: Cell[][]): { valid: ImportGuestRow[]; errors: RowError[] } {
  const valid: ImportGuestRow[] = [];
  const errors: RowError[] = [];
  if (aoa.length === 0) return { valid, errors };

  const headerRow = aoa[0] ?? [];
  const colIndex: Partial<Record<Header, number>> = {};
  headerRow.forEach((cell, i) => {
    const text = cellText(cell);
    const matched = GUEST_EXCEL_HEADERS.find((h) => h === text);
    if (matched) colIndex[matched] = i;
  });

  for (let r = 1; r < aoa.length; r += 1) {
    const row = aoa[r] ?? [];
    const rowNum = r; // 1-base: 헤더 제외 i번째 데이터행

    // 빈 행(모든 셀 공백/null): skip — valid도 errors도 아님.
    if (row.every((c) => cellText(c) === '')) continue;

    const get = (header: Header): string => {
      const idx = colIndex[header];
      return idx === undefined ? '' : cellText(row[idx]);
    };

    const nameText = get('이름');
    if (!nameText) { errors.push({ row: rowNum, reason: '이름 누락' }); continue; }

    const sideText = get('측');
    const side = normSide(sideText);
    if (!side) {
      errors.push({ row: rowNum, reason: sideText ? `측 값 인식 불가: '${sideText}'` : '측 누락' });
      continue;
    }

    const relationText = get('관계');
    const relation = normRelation(relationText);
    if (!relation) {
      errors.push({ row: rowNum, reason: relationText ? `관계 값 인식 불가: '${relationText}'` : '관계 누락' });
      continue;
    }

    const attendText = get('참석');
    let attendStatus: AttendStatus;
    if (!attendText) {
      attendStatus = 'MAYBE';
    } else {
      const a = normAttend(attendText);
      if (!a) { errors.push({ row: rowNum, reason: `참석 값 인식 불가: '${attendText}'` }); continue; }
      attendStatus = a;
    }

    const mealText = get('식사인원');
    let mealCount: number;
    if (!mealText) {
      mealCount = 1;
    } else {
      const n = Number(mealText);
      if (!Number.isInteger(n)) {
        errors.push({ row: rowNum, reason: `식사인원 값이 정수가 아님: '${mealText}'` });
        continue;
      }
      mealCount = n;
    }

    const giftText = get('축의금');
    let giftAmount: number | null;
    if (!giftText) {
      giftAmount = null;
    } else {
      const n = Number(giftText);
      if (!Number.isFinite(n)) {
        errors.push({ row: rowNum, reason: `축의금 값이 숫자가 아님: '${giftText}'` });
        continue;
      }
      giftAmount = n;
    }

    const isHost = normIsHost(get('혼주'));
    const memoText = get('메모');
    const memo = memoText ? memoText : null;

    valid.push({ name: nameText, side, relation, attendStatus, isHost, mealCount, giftAmount, memo });
  }

  return { valid, errors };
}
