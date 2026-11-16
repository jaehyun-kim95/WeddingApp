import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library/legacy';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

import type { Photo } from '@/types/db';
import { mimeTypeFromPath, photoFileName } from './api';
import { photoPublicUrl } from './upload';

// RN 글루 레이어 — expo-file-system/legacy·expo-media-library/legacy·expo-sharing은 여기서만
// import한다(하객 excel-io.ts와 동일한 분리; upload.ts의 "image-picker/Storage SDK만" 경계를 넓히지
// 않는다). 코어(api.ts)는 이 파일을 모른다. 사진은 public 버킷이라 photoPublicUrl로 서명 없이
// 내려받는다(ADR-0007).
// /legacy 서브패스를 쓰는 이유(두 모듈 공통): SDK 58부터 두 모듈의 기본 export가 File/Asset
// 클래스 기반 신규 API로 바뀌어, 문자열 uri 기반 함수(cacheDirectory·downloadAsync·
// saveToLibraryAsync)는 /legacy에만 남았다. excel-io.ts가 file-system에 쓰는 것과 동일한 선택.

// 공개 URL을 cacheDirectory에 내려받아 로컬 uri를 돌려준다. 공유·저장 모두 로컬 파일이 필요하다.
async function downloadToCache(photo: Photo): Promise<string> {
  // shareablePhotos를 통과한 사진만 넘어오므로 storage_path는 항상 존재한다(방어적으로 가드).
  const storagePath = photo.storage_path as string;
  const target = `${FileSystem.cacheDirectory}${photoFileName(storagePath)}`;
  const { uri } = await FileSystem.downloadAsync(photoPublicUrl(storagePath), target);
  return uri;
}

// 선택한 사진들을 기기 사진첩에 저장한다. 저장한 장수를 반환(권한 거부 시 Alert 후 0).
// requestPermissionsAsync(true)=write-only — 저장만 필요하므로 전체 사진첩 읽기 권한은 요구하지 않는다.
export async function savePhotosToDevice(photos: Photo[]): Promise<number> {
  if (photos.length === 0) return 0;
  const perm = await MediaLibrary.requestPermissionsAsync(true);
  if (!perm.granted) {
    Alert.alert('사진첩 접근 권한이 필요합니다', '설정에서 사진 저장 권한을 허용해 주세요.');
    return 0;
  }
  let saved = 0;
  for (const photo of photos) {
    const uri = await downloadToCache(photo);
    await MediaLibrary.saveToLibraryAsync(uri);
    saved += 1;
  }
  return saved;
}

// 선택한 사진들을 공유 시트로 순차 공유한다. expo-sharing은 한 번에 한 파일만 지원하므로
// await로 한 장씩 연다 — 사용자가 한 시트를 닫아야 다음 시트가 열린다(사용자 결정 2026-11-16).
export async function sharePhotosSequentially(photos: Photo[]): Promise<void> {
  if (photos.length === 0) return;
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    Alert.alert('공유를 사용할 수 없습니다', '이 기기에서는 공유 기능을 쓸 수 없습니다.');
    return;
  }
  for (const photo of photos) {
    const uri = await downloadToCache(photo);
    await Sharing.shareAsync(uri, {
      mimeType: mimeTypeFromPath(photo.storage_path as string),
      dialogTitle: '사진 공유',
    });
  }
}
