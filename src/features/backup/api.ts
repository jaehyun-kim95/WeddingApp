// 코어(순수) api 레이어 — lib/rpc에 얇게 위임한다(ADR-0003: supabase.rpc는 lib/rpc에만).
// 다른 feature(guests/api.ts)의 importGuests→rpc.importGuests 패턴과 동일.

import * as rpc from '@/lib/rpc';
import type { BackupData } from './backup-format';

// 백업 복원 — 현재 커플로의 전체 교체(ADR-0009). shareCode는 호출 훅이 주입.
export function restoreBackup(shareCode: string, data: BackupData) {
  return rpc.restoreBackup(shareCode, data);
}

export type { BackupData } from './backup-format';
