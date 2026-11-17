// RN 글루 레이어(ADR-0006 엑셀 3계층 미러링) — expo-document-picker/expo-file-system(legacy)/
// expo-sharing은 여기서만 import한다(코어 backup-format.ts는 순수 변환만, RN 모듈을 모른다).
// 엑셀과 달리 백업은 base64가 아니라 EncodingType.UTF8 텍스트(JSON)로 읽고 쓴다.

import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

import type { Area, CoupleSnapshot } from '@/types/db';
import { buildBackup, parseBackup, type ParseResult } from './backup-format';

// 스냅샷을 JSON 백업 파일로 내보내 공유 시트를 연다. 파일명 wedding-backup-YYYYMMDD.json.
export async function exportBackup(snapshot: CoupleSnapshot, areas: Area[]): Promise<void> {
  const now = new Date();
  const file = buildBackup(snapshot, areas, now);
  const json = JSON.stringify(file, null, 2);

  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const fileName = `wedding-backup-${y}${m}${d}.json`;
  const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

  await FileSystem.writeAsStringAsync(fileUri, json, { encoding: FileSystem.EncodingType.UTF8 });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    Alert.alert('공유를 사용할 수 없습니다', `파일이 저장됐습니다: ${fileUri}`);
    return;
  }
  await Sharing.shareAsync(fileUri, {
    mimeType: 'application/json',
    dialogTitle: '백업 내보내기',
  });
}

// 사용자가 .json 백업 파일을 골라 파싱한다. 취소하면 null, 그 외엔 parseBackup 결과를 그대로 반환.
// JSON.parse 실패(깨진 파일)는 여기서 MALFORMED로 변환한다(코어는 파싱된 값만 다룬다).
//
// 읽기는 FileSystem.readAsStringAsync가 아니라 fetch로 한다(2026-11-17, 실기기 리포트로 발견) —
// Android의 Expo Go에서 expo-document-picker가 복사본을 host 앱의 원시 context.cacheDir에 쓰는데,
// expo-file-system(legacy)의 읽기 권한 검사는 Expo Go의 실험별 샌드박스 경로(appContext.cacheDirectory,
// 즉 cache/ExperienceData/<id>/...)만 허용해 둘이 어긋나 방금 복사된 파일을 "isn't readable"로
// 거부한다(개발빌드에선 두 경로가 같아 재현 안 됨, Expo Go 전용 구조적 버그). fetch는 이 권한
// 게이트를 거치지 않아 같은 file:// URI를 문제없이 읽는다.
export async function pickAndParseBackup(): Promise<ParseResult | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (picked.canceled || !picked.assets?.[0]) return null;

  const uri = picked.assets[0].uri;
  const text = await (await fetch(uri)).text();

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'MALFORMED' };
  }
  return parseBackup(raw);
}
