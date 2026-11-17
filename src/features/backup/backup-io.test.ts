// 회귀 테스트: 백업 가져오기는 picked 파일을 FileSystem.readAsStringAsync가 아니라 fetch로 읽어야
// 한다(2026-11-17, Android Expo Go 실기기 리포트 — expo-document-picker가 host 앱의 원시
// context.cacheDir에 복사본을 쓰는데 expo-file-system(legacy)의 읽기 권한 검사는 Expo Go의 실험별
// 샌드박스 경로만 허용해 "isn't readable"로 거부됨). fetch는 이 권한 게이트를 타지 않는다.
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

import { pickAndParseBackup } from './backup-io';
import { BACKUP_APP, BACKUP_SCHEMA_VERSION } from './backup-format';

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock('expo-file-system/legacy', () => ({
  EncodingType: { UTF8: 'utf8' },
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  cacheDirectory: 'file:///cache/',
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));

const validFile = {
  app: BACKUP_APP,
  schema_version: BACKUP_SCHEMA_VERSION,
  db_schema: 'v1.2',
  exported_at: '2026-11-17T00:00:00.000Z',
  data: {
    couple: {}, checklist_items: [], schedule_events: [], vendors: [], expenses: [],
    expense_options: [], expense_splits: [], payments: [], area_budgets: [], guests: [], photos: [],
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  (global as unknown as { fetch: jest.Mock }).fetch = jest.fn(async () => ({
    text: async () => JSON.stringify(validFile),
  }));
});

describe('pickAndParseBackup', () => {
  test('취소하면 null을 반환하고 아무것도 읽지 않는다', async () => {
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({ canceled: true });
    const result = await pickAndParseBackup();
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('선택한 파일을 fetch로 읽어 파싱한다(FileSystem.readAsStringAsync는 쓰지 않는다)', async () => {
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///cache/DocumentPicker/abc.json' }],
    });
    const result = await pickAndParseBackup();
    expect(global.fetch).toHaveBeenCalledWith('file:///cache/DocumentPicker/abc.json');
    expect(FileSystem.readAsStringAsync).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, file: validFile, warnings: [] });
  });

  test('fetch된 내용이 깨진 JSON이면 MALFORMED(오탐 없이 병리 입력만)', async () => {
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///cache/DocumentPicker/broken.json' }],
    });
    (global as unknown as { fetch: jest.Mock }).fetch = jest.fn(async () => ({
      text: async () => '{not valid json',
    }));
    const result = await pickAndParseBackup();
    expect(result).toEqual({ ok: false, reason: 'MALFORMED' });
  });
});
