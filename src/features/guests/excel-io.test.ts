// 회귀 테스트: 엑셀 가져오기는 picked 파일을 FileSystem.readAsStringAsync가 아니라 fetch로 읽어야
// 한다(2026-11-17, 백업 가져오기와 같은 근본 원인 — Android Expo Go에서 expo-document-picker가
// host 앱의 원시 context.cacheDir에 복사본을 쓰는데 expo-file-system(legacy)의 읽기 권한 검사는
// Expo Go의 실험별 샌드박스 경로만 허용해 "isn't readable"로 거부됨). fetch+arrayBuffer는 이 권한
// 게이트를 타지 않고, XLSX.read({type:'array'})로 base64 왕복 없이 바로 읽는다.
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';

import { GUEST_EXCEL_HEADERS } from './guest-excel';
import { pickAndParseExcel } from './excel-io';

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock('expo-file-system/legacy', () => ({
  EncodingType: { Base64: 'base64' },
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  cacheDirectory: 'file:///cache/',
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));

// 실제 xlsx로 작은 워크북을 만들어 arrayBuffer로 돌려준다 — fetch 목이 진짜 바이너리를 주는 셈이라
// XLSX.read({type:'array'}) 경로까지 실제로 검증한다(목만 서로 맞춰주는 가짜 통과 방지).
function buildSampleXlsxArrayBuffer(): ArrayBuffer {
  const aoa = [[...GUEST_EXCEL_HEADERS], ['홍길동', '신랑', '가족', '참석', 1, 100000, '', '']];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, '하객');
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

beforeEach(() => {
  jest.clearAllMocks();
  (global as unknown as { fetch: jest.Mock }).fetch = jest.fn(async () => ({
    arrayBuffer: async () => buildSampleXlsxArrayBuffer(),
  }));
});

describe('pickAndParseExcel', () => {
  test('취소하면 null을 반환하고 아무것도 읽지 않는다', async () => {
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({ canceled: true });
    const result = await pickAndParseExcel();
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('선택한 파일을 fetch로 읽어 파싱한다(FileSystem.readAsStringAsync는 쓰지 않는다)', async () => {
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///cache/DocumentPicker/guests.xlsx' }],
    });
    const result = await pickAndParseExcel();
    expect(global.fetch).toHaveBeenCalledWith('file:///cache/DocumentPicker/guests.xlsx');
    expect(FileSystem.readAsStringAsync).not.toHaveBeenCalled();
    expect(result?.errors).toEqual([]);
    expect(result?.valid).toEqual([
      { name: '홍길동', side: 'GROOM', relation: 'FAMILY', attendStatus: 'ATTENDING', isHost: false, mealCount: 1, giftAmount: 100000, memo: null },
    ]);
  });
});
