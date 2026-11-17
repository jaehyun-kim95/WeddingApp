// 코어(순수 로직) — expo/RN을 import하지 않는다. 미납 payment의 due_date로부터
// 로컬 알림 발화 계획(ReminderPlan)을 계산한다. 실제 예약은 notifications-io.ts가 맡는다.
import type { Payment } from '@/types/db';

// 한 번의 알림 발화 계획. id는 payment·dayOffset 조합으로 안정·유일(재동기화 diff 키).
export type ReminderPlan = {
  id: string;
  fireAt: Date;
  title: string;
  body: string;
};

// hour: 발화 시(0~23). daysBefore: 며칠 전에 울릴지(0=당일). now: 과거 판정 기준(주입으로 결정론 보장).
export type ReminderOptions = {
  hour: number;
  daysBefore: number[];
  now: Date;
};

// 'YYYY-MM-DD'를 연·월·일로 방어적으로 파싱한다. 형식이 깨지면 null(호출부가 건너뜀).
function parseYmd(due: string): { year: number; month: number; day: number } | null {
  const parts = due.split('-');
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map((p) => Number(p));
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { year: y, month: m, day: d };
}

// body 문구(한국어). 당일(0)과 N일 전을 구분한다.
function reminderBody(dayOffset: number): string {
  return dayOffset === 0 ? '오늘 납부 예정일입니다' : `${dayOffset}일 후 납부 예정일입니다`;
}

// 미납·due_date 존재 payment만, daysBefore마다 발화 계획을 만든다. 과거(fireAt<=now) 발화는 제외.
// notifyEnabled=false면 아무 계획도 만들지 않는다(토글 OFF).
export function computePaymentReminders(
  payments: Payment[],
  notifyEnabled: boolean,
  opts: ReminderOptions,
): ReminderPlan[] {
  if (!notifyEnabled) return [];
  const nowMs = opts.now.getTime();
  const plans: ReminderPlan[] = [];

  for (const p of payments) {
    if (p.is_paid || p.due_date == null) continue;
    const ymd = parseYmd(p.due_date);
    if (!ymd) continue;

    for (const dayOffset of opts.daysBefore) {
      // 발화 시각 = (due_date - dayOffset일)의 opts.hour시 정각(로컬).
      const fireAt = new Date(ymd.year, ymd.month - 1, ymd.day - dayOffset, opts.hour, 0, 0, 0);
      if (fireAt.getTime() <= nowMs) continue; // 과거(또는 정각 동일)는 제외
      plans.push({
        id: `payment:${p.id}:${dayOffset}`,
        fireAt,
        title: '납부 예정',
        body: reminderBody(dayOffset),
      });
    }
  }

  return plans;
}

// 이미 예약된 id 목록과 목표 계획을 비교해 증분 동작을 계산한다. 이번 세션은 전체 재동기화
// 전략(cancelAll 후 전량 재예약)을 쓰지만, 다른 알림 종류가 생길 때 증분 예약으로 전환할 수
// 있도록 설계상 둔다(테스트로 계약 고정).
export function diffReminders(
  desired: ReminderPlan[],
  scheduledIds: string[],
): { toCancel: string[]; toSchedule: ReminderPlan[] } {
  const desiredIds = new Set(desired.map((p) => p.id));
  const scheduledSet = new Set(scheduledIds);
  const toSchedule = desired.filter((p) => !scheduledSet.has(p.id));
  const toCancel = scheduledIds.filter((id) => !desiredIds.has(id));
  return { toCancel, toSchedule };
}
