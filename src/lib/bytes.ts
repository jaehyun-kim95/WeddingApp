// 바이트 표시 단위 변환. 저장은 바이트(photo.size_bytes, DB), 표시는 MB/GB(갤러리 용량 통계·
// 80% 경고 전용 — 금액이 아니므로 money.ts와 분리한다).

const MB = 1024 * 1024;
const GB = MB * 1024;

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0MB';
  if (bytes < 1000 * MB) return `${(bytes / MB).toFixed(1)}MB`;
  return `${(bytes / GB).toFixed(1)}GB`;
}
