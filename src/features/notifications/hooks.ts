import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useCoupleSnapshot } from '@/features/couple';
import { useShareCode } from '@/providers/share-code-provider';
import type { CoupleSnapshot, Payment } from '@/types/db';
import {
  clearAllPaymentReminders,
  ensureNotificationSetup,
  syncPaymentReminders,
} from './notifications-io';
import { computePaymentReminders } from './payment-reminders';

// 발화 규칙(사용자 결정): 3일 전 + 당일 아침 09:00.
const REMINDER_HOUR = 9;
const REMINDER_DAYS_BEFORE = [3, 0];

// 스냅샷에서 알림 동기화에 필요한 최소 슬라이스만 뽑는다(payments + notify 토글).
// react-query가 구조 공유로 메모해, 내용이 같으면 참조가 안정 → 불필요한 재동기화를 막는다.
type ReminderSlice = { payments: Payment[]; notifyPayments: boolean };
function selectReminderSlice(snapshot: CoupleSnapshot): ReminderSlice {
  return { payments: snapshot.payments, notifyPayments: snapshot.couple.notify_payments };
}

// 납부일 로컬 알림을 스냅샷·앱 상태에 맞춰 동기화한다. _layout의 RootNav에서 1회 호출.
// 자체 가드(공유코드 ready일 때만 동작)를 두므로 호출부는 조건 없이 그냥 부르면 된다.
export function usePaymentReminderSync(): void {
  const { status } = useShareCode();
  const { data } = useCoupleSnapshot(selectReminderSlice);

  // 최신 슬라이스를 ref로 들고 있어 AppState 콜백이 스테일 클로저를 쓰지 않게 한다.
  // ref 갱신은 렌더 중이 아니라 커밋 후(effect)에 한다.
  const sliceRef = useRef<ReminderSlice | null>(null);
  useEffect(() => {
    sliceRef.current = status === 'ready' ? (data ?? null) : null;
  }, [status, data]);

  const sync = useCallback(async () => {
    const slice = sliceRef.current;
    if (!slice) return; // 공유코드 미준비 또는 스냅샷 미로드
    // 알림 동기화는 백그라운드 부가 기능이다 — 여기서 난 오류가 화면을 막거나 앱을 중단시키면
    // 안 된다(실측 사례: 일부 Android 기기의 네이티브 알림 채널 생성 실패가 캐치되지 않은 Promise
    // 거부로 올라와 에러 화면을 띄움, 2026-11-17). 무슨 일이 있어도 조용히 건너뛴다.
    try {
      if (!slice.notifyPayments) {
        // 토글 OFF → 예약된 알림을 모두 취소.
        await clearAllPaymentReminders();
        return;
      }
      const ok = await ensureNotificationSetup();
      if (!ok) return; // 권한 없음/비실기기/채널 생성 실패 — 예약 생략
      const plans = computePaymentReminders(slice.payments, true, {
        hour: REMINDER_HOUR,
        daysBefore: REMINDER_DAYS_BEFORE,
        now: new Date(),
      });
      await syncPaymentReminders(plans);
    } catch (e) {
      if (__DEV__) console.warn('[notifications] 알림 동기화 실패(무시하고 계속 진행):', e);
    }
  }, []);

  // 스냅샷 데이터(payments·토글) 변경 시 재동기화.
  useEffect(() => {
    if (status !== 'ready') return;
    void sync();
  }, [status, data, sync]);

  // 앱이 포그라운드로 돌아올 때 재동기화(백그라운드 동안 날짜가 지나 과거가 된 예약을 정리).
  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (next === 'active') void sync();
    };
    const subscription = AppState.addEventListener('change', onChange);
    return () => subscription.remove();
  }, [sync]);
}
