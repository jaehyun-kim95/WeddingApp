// RN 글루 레이어(ADR-0006) — xlsx/expo-file-system/expo-document-picker/expo-sharing은
// 여기서만 import한다(코어 guest-excel.ts는 순수 변환만, RN 모듈을 모른다).
// expo-file-system/legacy: readAsStringAsync/writeAsStringAsync(base64) — 설치된 버전(~58)은
// 기본 export가 File/Directory 클래스 기반 신규 API로 바뀌어 base64 문자열 I/O가 불편해,
// 문자열 기반 레거시 API(FileSystem.EncodingType.Base64)를 그대로 쓴다. XLSX도 base64 문자열로
// 읽고/쓴다(ADR-0006).
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import * as XLSX from 'xlsx';

import type { Guest } from '@/types/db';
import type { ImportGuestRow } from './api';
import { buildGuestAoa, parseGuestRows } from './guest-excel';
import type { RowError } from './types';

// 사용자가 .xlsx 파일을 골라 하객 행으로 파싱한다. 취소하면 null.
export async function pickAndParseExcel(): Promise<{ valid: ImportGuestRow[]; errors: RowError[] } | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (picked.canceled || !picked.assets?.[0]) return null;

  const uri = picked.assets[0].uri;
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const workbook = XLSX.read(base64, { type: 'base64' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return { valid: [], errors: [] };
  const sheet = workbook.Sheets[firstSheetName];
  const aoa = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1 });
  return parseGuestRows(aoa);
}

// 하객 목록을 .xlsx로 내보내 공유 시트를 연다.
export async function exportGuestsToExcel(guests: Guest[]): Promise<void> {
  const aoa = buildGuestAoa(guests);
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, '하객');
  const base64 = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' }) as string;

  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const fileName = `guests-${y}${m}${d}.xlsx`;
  const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

  await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    Alert.alert('공유를 사용할 수 없습니다', `파일이 저장됐습니다: ${fileUri}`);
    return;
  }
  await Sharing.shareAsync(fileUri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: '하객 명단 내보내기',
  });
}
