// RN 글루 레이어 — expo-notifications / expo-device는 여기서만 import한다(코어
// payment-reminders.ts는 순수 계산만, RN 모듈을 모른다). 권한·채널·포그라운드 핸들러 설정과
// 실제 로컬 알림 예약/취소를 담당한다.
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
// AndroidImportance는 expo-notifications가 `export *`로 재노출해 네임스페이스 접근
// (Notifications.AndroidImportance)이 import/namespace 린트에 안 잡혀 named import로 가져온다.
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import type { ReminderPlan } from './payment-reminders';

// Android 로컬 알림 채널(이번 세션은 Expo Go iOS만 검증 — Android 채널/권한/아이콘은 미검증).
const ANDROID_CHANNEL_ID = 'payments';

let handlerConfigured = false;

// 포그라운드에서도 배너로 보이도록 핸들러를 1회 설정한다(SDK 58 shape).
function configureForegroundHandler(): void {
  if (handlerConfigured) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  handlerConfigured = true;
}

// 알림 예약 전 1회 준비: Android 채널 선행 등록 → 권한 확인/요청 → 포그라운드 핸들러.
// 권한이 없으면 false(호출부가 예약을 건너뛴다). 시뮬레이터(비실기기)는 권한을 못 받아 false.
export async function ensureNotificationSetup(): Promise<boolean> {
  if (Platform.OS === 'android') {
    // Expo Go(일부 Android 기기)에서 네이티브 NotificationChannelManager가 NullPointerException으로
    // 거부하는 사례 발견(2026-11-17, 실기기 리포트) — config plugin 없이는 채널 생성이 보장되지 않는다
    // (dev build 필요, 알려진 제약). 실패해도 앱을 중단시키지 않고 "이 기기에서는 알림 불가"로 취급한다.
    try {
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: '납부일 알림',
        importance: AndroidImportance.DEFAULT,
      });
    } catch {
      return false;
    }
  }

  // 실기기에서만 알림 권한이 의미가 있다(에뮬레이터/시뮬레이터는 발화 보장 안 됨).
  if (!Device.isDevice) return false;

  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.granted;
  if (!granted && existing.canAskAgain) {
    const requested = await Notifications.requestPermissionsAsync();
    granted = requested.granted;
  }
  if (!granted) return false;

  configureForegroundHandler();
  return true;
}

// 전체 재동기화 전략: 예약된 알림을 모두 취소하고 목표 계획을 전량 재예약한다(증분 diff는
// diffReminders가 설계상 준비돼 있으나, 납부 알림 한 종류뿐이라 전량 재예약이 단순·안전).
export async function syncPaymentReminders(plans: ReminderPlan[]): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const plan of plans) {
    await Notifications.scheduleNotificationAsync({
      identifier: plan.id,
      content: { title: plan.title, body: plan.body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: plan.fireAt },
    });
  }
}

// 토글 OFF일 때 예약된 납부 알림을 전부 취소한다.
export async function clearAllPaymentReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
