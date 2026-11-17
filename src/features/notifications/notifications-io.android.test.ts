// 회귀 테스트: 일부 Android 기기에서 네이티브 알림 채널 생성이 NullPointerException으로 거부되는
// 사례(2026-11-17, 실기기 리포트 — config plugin 없는 Expo Go의 알려진 제약)를 ensureNotificationSetup이
// 조용히 삼키고 false를 반환하는지 검증한다. Platform.OS='android' 전용이라 별도 파일로 분리.
import * as Notifications from 'expo-notifications';

import { ensureNotificationSetup } from './notifications-io';

jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));

jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3 },
  setNotificationChannelAsync: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  setNotificationHandler: jest.fn(),
}));

jest.mock('expo-device', () => ({ isDevice: true }));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ensureNotificationSetup — Android 채널 생성 실패', () => {
  test('setNotificationChannelAsync가 거부돼도 던지지 않고 false를 반환한다', async () => {
    (Notifications.setNotificationChannelAsync as jest.Mock).mockRejectedValueOnce(
      new Error('NullPointerException'),
    );
    await expect(ensureNotificationSetup()).resolves.toBe(false);
  });

  test('채널 생성이 성공하면 권한까지 확인해 true를 반환한다(오탐 방지)', async () => {
    (Notifications.setNotificationChannelAsync as jest.Mock).mockResolvedValueOnce(undefined);
    await expect(ensureNotificationSetup()).resolves.toBe(true);
  });
});
