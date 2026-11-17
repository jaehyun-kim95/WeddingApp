// 글루 테스트: expo-notifications를 목으로 대체해 syncPaymentReminders가 cancelAll 1회 +
// plan 수만큼 scheduleNotificationAsync를 호출하는지 검증한다(계산 로직은 코어 테스트 담당).
import * as Notifications from 'expo-notifications';

import { clearAllPaymentReminders, syncPaymentReminders } from './notifications-io';
import type { ReminderPlan } from './payment-reminders';

// jest.mock는 babel-plugin-jest-hoist가 import 위로 끌어올리므로 import 아래에 둬도 안전하다.
jest.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { DATE: 'date' },
  AndroidImportance: { DEFAULT: 3 },
  cancelAllScheduledNotificationsAsync: jest.fn(async () => undefined),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
}));

jest.mock('expo-device', () => ({ isDevice: true }));

const plan = (id: string): ReminderPlan => ({
  id,
  fireAt: new Date(2026, 11, 20, 9),
  title: '납부 예정',
  body: '오늘 납부 예정일입니다',
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('syncPaymentReminders', () => {
  test('cancelAll 1회 + plan 수만큼 schedule 호출', async () => {
    await syncPaymentReminders([plan('payment:a:0'), plan('payment:b:3')]);
    expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
  });

  test('plan이 비면 cancelAll만, schedule은 호출 안 함', async () => {
    await syncPaymentReminders([]);
    expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  test('각 plan은 DATE 트리거·id·제목/본문으로 예약된다', async () => {
    await syncPaymentReminders([plan('payment:a:0')]);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: 'payment:a:0',
      content: { title: '납부 예정', body: '오늘 납부 예정일입니다' },
      trigger: { type: 'date', date: new Date(2026, 11, 20, 9) },
    });
  });
});

describe('clearAllPaymentReminders', () => {
  test('cancelAll 1회 호출', async () => {
    await clearAllPaymentReminders();
    expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
  });
});
