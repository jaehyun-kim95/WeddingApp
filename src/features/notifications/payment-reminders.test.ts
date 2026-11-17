import type { Payment } from '@/types/db';
import {
  computePaymentReminders,
  diffReminders,
  type ReminderOptions,
  type ReminderPlan,
} from './payment-reminders';

// 결정론적 테스트를 위해 now를 고정 주입한다. 모든 시각은 로컬 타임존 기준으로 구성한다
// (코어가 new Date(y, m-1, d, hour)로 만들고, 테스트도 같은 방식으로 기대값을 만든다).
const payment = (id: string, extra: Partial<Payment> = {}): Payment => ({
  id,
  created_at: '',
  couple_id: 'c1',
  expense_id: 'e1',
  kind: 'BALANCE',
  amount: 1_000_000,
  due_date: '2026-12-20',
  payer: 'ME',
  is_paid: false,
  paid_at: null,
  ...extra,
});

// 기준 now: 2026-12-01 00:00 로컬. 발화 옵션은 사용자 결정(3일 전 + 당일 09:00).
const baseOpts = (now: Date, overrides: Partial<ReminderOptions> = {}): ReminderOptions => ({
  hour: 9,
  daysBefore: [3, 0],
  now,
  ...overrides,
});

const localDate = (y: number, m: number, d: number, h = 0) => new Date(y, m - 1, d, h, 0, 0, 0);

describe('computePaymentReminders', () => {
  test('notifyEnabled=false면 빈 배열', () => {
    const now = localDate(2026, 12, 1);
    expect(computePaymentReminders([payment('p1')], false, baseOpts(now))).toEqual([]);
  });

  test('납부 완료(is_paid=true)·due_date=null은 제외', () => {
    const now = localDate(2026, 12, 1);
    const plans = computePaymentReminders(
      [
        payment('paid', { is_paid: true }),
        payment('nodue', { due_date: null }),
        payment('ok'),
      ],
      true,
      baseOpts(now),
    );
    // ok 하나만 남고(미래라 2계획), paid/nodue는 어떤 계획도 없다.
    expect(plans.every((p) => p.id.startsWith('payment:ok:'))).toBe(true);
    expect(plans).toHaveLength(2);
  });

  test('과거 발화시각은 제외(now 기준 경계값)', () => {
    // due_date=2026-12-01, now=2026-12-01 09:00 정각 → 당일 09:00 발화는 now와 같아 과거로 간주(<=now).
    const now = localDate(2026, 12, 1, 9);
    const plans = computePaymentReminders([payment('p1', { due_date: '2026-12-01' })], true, baseOpts(now));
    // 3일 전(11-28 09:00)·당일(12-01 09:00) 둘 다 now 이하라 전부 제외.
    expect(plans).toEqual([]);
  });

  test('과거 경계: fireAt이 now보다 1분이라도 미래면 포함', () => {
    const now = localDate(2026, 12, 1, 8, /* 분은 Date 생성자에 안 넘기므로 아래서 직접 */);
    now.setMinutes(59);
    // 당일 09:00 발화는 08:59보다 미래 → 포함. 3일 전(11-28)은 과거 → 제외.
    const plans = computePaymentReminders([payment('p1', { due_date: '2026-12-01' })], true, baseOpts(now));
    expect(plans).toHaveLength(1);
    expect(plans[0].id).toBe('payment:p1:0');
    expect(plans[0].fireAt).toEqual(localDate(2026, 12, 1, 9));
  });

  test('daysBefore=[3,0]면 미래 payment당 계획 2개', () => {
    const now = localDate(2026, 12, 1);
    const plans = computePaymentReminders([payment('p1', { due_date: '2026-12-20' })], true, baseOpts(now));
    expect(plans).toHaveLength(2);
    const ids = plans.map((p) => p.id).sort();
    expect(ids).toEqual(['payment:p1:0', 'payment:p1:3']);
  });

  test('3일 전 시점이 이미 과거면 당일 계획 1개만', () => {
    // due_date=2026-12-02, now=2026-12-01 00:00. 3일 전=11-29 09:00(과거), 당일=12-02 09:00(미래).
    const now = localDate(2026, 12, 1);
    const plans = computePaymentReminders([payment('p1', { due_date: '2026-12-02' })], true, baseOpts(now));
    expect(plans).toHaveLength(1);
    expect(plans[0].id).toBe('payment:p1:0');
  });

  test('fireAt이 정확한 날짜·시(hour=9)로 계산된다', () => {
    const now = localDate(2026, 12, 1);
    const plans = computePaymentReminders([payment('p1', { due_date: '2026-12-20' })], true, baseOpts(now));
    const byOffset = Object.fromEntries(plans.map((p) => [p.id, p.fireAt]));
    expect(byOffset['payment:p1:3']).toEqual(localDate(2026, 12, 17, 9)); // 3일 전 09:00
    expect(byOffset['payment:p1:0']).toEqual(localDate(2026, 12, 20, 9)); // 당일 09:00
  });

  test('body는 한국어(3일 후 / 오늘)', () => {
    const now = localDate(2026, 12, 1);
    const plans = computePaymentReminders([payment('p1', { due_date: '2026-12-20' })], true, baseOpts(now));
    const byId = Object.fromEntries(plans.map((p) => [p.id, p]));
    expect(byId['payment:p1:3'].title).toBe('납부 예정');
    expect(byId['payment:p1:3'].body).toBe('3일 후 납부 예정일입니다');
    expect(byId['payment:p1:0'].body).toBe('오늘 납부 예정일입니다');
  });

  test('id는 payment·dayOffset 조합으로 유일·안정', () => {
    const now = localDate(2026, 12, 1);
    const plans = computePaymentReminders(
      [payment('a', { due_date: '2026-12-20' }), payment('b', { due_date: '2026-12-21' })],
      true,
      baseOpts(now),
    );
    const ids = plans.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length); // 전부 유일
    expect(ids).toContain('payment:a:3');
    expect(ids).toContain('payment:b:0');
    // 동일 입력 재실행 → 동일 id(안정)
    const again = computePaymentReminders(
      [payment('a', { due_date: '2026-12-20' })],
      true,
      baseOpts(now),
    );
    expect(again.map((p) => p.id).sort()).toEqual(['payment:a:0', 'payment:a:3']);
  });

  test('오탐 방지: 정상 미래 payment는 계획을 생성한다', () => {
    const now = localDate(2026, 12, 1);
    const plans = computePaymentReminders([payment('ok', { due_date: '2026-12-31' })], true, baseOpts(now));
    expect(plans.length).toBeGreaterThan(0);
  });

  describe('병리 입력', () => {
    test('빈 payments → 빈 배열', () => {
      const now = localDate(2026, 12, 1);
      expect(computePaymentReminders([], true, baseOpts(now))).toEqual([]);
    });

    test('깨진 due_date 문자열은 조용히 건너뛴다', () => {
      const now = localDate(2026, 12, 1);
      const plans = computePaymentReminders(
        [payment('bad', { due_date: 'not-a-date' }), payment('ok', { due_date: '2026-12-20' })],
        true,
        baseOpts(now),
      );
      expect(plans.every((p) => p.id.startsWith('payment:ok:'))).toBe(true);
      expect(plans).toHaveLength(2);
    });

    test('daysBefore 빈 배열 → 어떤 계획도 없음', () => {
      const now = localDate(2026, 12, 1);
      const plans = computePaymentReminders(
        [payment('p1', { due_date: '2026-12-20' })],
        true,
        baseOpts(now, { daysBefore: [] }),
      );
      expect(plans).toEqual([]);
    });
  });
});

describe('diffReminders', () => {
  const plan = (id: string): ReminderPlan => ({
    id,
    fireAt: new Date(2026, 11, 20, 9),
    title: '납부 예정',
    body: '오늘 납부 예정일입니다',
  });

  test('새로 예약할 것·취소할 것을 정확히 분리', () => {
    const desired = [plan('payment:a:0'), plan('payment:b:3')];
    const scheduledIds = ['payment:a:0', 'payment:c:0'];
    const { toCancel, toSchedule } = diffReminders(desired, scheduledIds);
    // a:0은 이미 예약됨 → 유지(스케줄 안 함). b:3은 새로 예약. c:0은 더 이상 필요 없어 취소.
    expect(toSchedule.map((p) => p.id)).toEqual(['payment:b:3']);
    expect(toCancel).toEqual(['payment:c:0']);
  });

  test('desired가 비면 전부 취소', () => {
    const { toCancel, toSchedule } = diffReminders([], ['payment:a:0']);
    expect(toCancel).toEqual(['payment:a:0']);
    expect(toSchedule).toEqual([]);
  });

  test('scheduledIds가 비면 전부 예약', () => {
    const desired = [plan('payment:a:0')];
    const { toCancel, toSchedule } = diffReminders(desired, []);
    expect(toCancel).toEqual([]);
    expect(toSchedule.map((p) => p.id)).toEqual(['payment:a:0']);
  });
});
