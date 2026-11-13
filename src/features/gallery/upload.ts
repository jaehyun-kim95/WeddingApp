import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';

// RN 글루 레이어(ADR-0007) — expo-image-picker/base64-arraybuffer/supabase Storage SDK는 여기서만
// import한다. 코어(api.ts)는 이 파일을 모른다. 카메라 촬영은 범위 밖(설계 스펙 결정 2) — 기기
// 갤러리 선택만 지원한다.
export type PickedPhoto = {
  previewUri: string; // 로컬 미리보기(업로드 시트에 그대로 보여준다)
  buffer: ArrayBuffer;
  contentType: string;
  ext: string;
  sizeBytes: number;
};

// 기기 갤러리에서 사진 1장 선택. 권한 거부·취소 시 null.
export async function pickImage(): Promise<PickedPhoto | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, base64: true,
  });
  if (result.canceled || !result.assets?.[0]?.base64) return null;
  const asset = result.assets[0];
  const buffer = decode(asset.base64 as string);
  const contentType = asset.mimeType ?? 'image/jpeg';
  const ext = contentType.split('/')[1] ?? 'jpg';
  return { previewUri: asset.uri, buffer, contentType, ext, sizeBytes: buffer.byteLength };
}

// Storage 직접 업로드(ADR-0007 — couple.id 경로 접두사 RLS, RPC 게이트웨이의 의도된 예외).
export async function uploadPhotoFile(coupleId: string, picked: PickedPhoto): Promise<string> {
  const path = `${coupleId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${picked.ext}`;
  const { error } = await supabase.storage.from('photos').upload(path, picked.buffer, {
    contentType: picked.contentType,
  });
  if (error) throw error;
  return path;
}

// Storage 직접 삭제(ADR-0007). delete_photo RPC보다 반드시 먼저 호출한다 — 순서가 바뀌면(행 먼저
// 삭제) 오브젝트만 고아로 남고 가리킬 행이 없어 재시도가 어려워진다. 오브젝트를 먼저 지우면 행
// 삭제가 실패해도 "안 보이는 사진이 Storage에 미세하게 남는" 더 안전한 상태로 재시도할 수 있다.
export async function deletePhotoFile(storagePath: string): Promise<void> {
  const { error } = await supabase.storage.from('photos').remove([storagePath]);
  if (error) throw error;
}

// public 버킷이므로 서명 URL 없이 공개 URL로 바로 표시한다.
export function photoPublicUrl(storagePath: string): string {
  return supabase.storage.from('photos').getPublicUrl(storagePath).data.publicUrl;
}
