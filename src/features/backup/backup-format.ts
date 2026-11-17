// 백업 파일 포맷 코어(순수) — RN/expo/supabase 비의존. 백업 번들의 빌드·파싱·버전 처리만 담는다.
// 실제 파일 I/O(쓰기·공유·피커)는 상위 글루 레이어(backup-io.ts)가 처리한다(엑셀 3계층 패턴 미러링).
//
// 버전 체계(ADR-0009): 백업 "파일 포맷" 버전(schema_version, 정수)과 DB 스키마 버전(db_schema,
// 표시용 문자열)을 분리한다. 하위호환은 현재+직전 1버전까지만 읽어준다(docs/db/README.md 정책).

import type {
  Area, AreaBudget, AreaCode, ChecklistItem, Couple, CoupleSnapshot, Expense, ExpenseOption,
  ExpenseSplit, Guest, Payment, Photo, ScheduleEvent, Vendor,
} from '@/types/db';

// 백업 파일 포맷 버전(정수). 포맷이 바뀌면 +1 하고 migrateBackup에 변환 단계를 추가한다.
export const BACKUP_SCHEMA_VERSION = 1;
// 읽어줄 수 있는 최소 버전(현재+직전 1버전 정책 — 지금은 0까지 수용).
export const BACKUP_MIN_READABLE = 0;
// 참고용 DB 스키마 라벨(마이그레이션 0001~0009 = v1.2). 복원 호환성 판단엔 쓰지 않고 표시만 한다.
export const BACKUP_DB_SCHEMA = 'v1.2';

export const BACKUP_APP = 'weddingapp' as const;

// area_id를 가진 행에 area_code를 동봉한 형태(복원 시 area.code로 재해소 — UUID 직접 신뢰 금지).
type WithAreaCode<T> = T & { area_code: AreaCode | null };

// 백업 data 본체 — CoupleSnapshot 기반이되 couple.share_code 제외 + area 행에 area_code 동봉.
export type BackupData = {
  couple: Omit<Couple, 'share_code'>;
  checklist_items: WithAreaCode<ChecklistItem>[];
  schedule_events: WithAreaCode<ScheduleEvent>[];
  vendors: WithAreaCode<Vendor>[];
  expenses: WithAreaCode<Expense>[];
  expense_options: ExpenseOption[];
  expense_splits: ExpenseSplit[];
  payments: Payment[];
  area_budgets: WithAreaCode<AreaBudget>[];
  guests: Guest[];
  photos: WithAreaCode<Photo>[];
};

export type BackupFile = {
  app: typeof BACKUP_APP;
  schema_version: number;
  db_schema: string;
  exported_at: string; // ISO 8601
  data: BackupData;
};

export type ParseFailReason = 'NOT_BACKUP' | 'VERSION_TOO_NEW' | 'VERSION_TOO_OLD' | 'MALFORMED';

export type ParseResult =
  | { ok: true; file: BackupFile; warnings: string[] }
  | { ok: false; reason: ParseFailReason };

// area 행이 담긴 테이블 키(복원 시 area_code 재해소가 필요한 것들) — countRows·검증 공용.
const AREA_TABLE_KEYS = [
  'checklist_items', 'schedule_events', 'vendors', 'expenses', 'area_budgets', 'photos',
] as const;

// data의 배열 테이블 전체 키(couple 제외). 검증·건수 집계 공용.
const ARRAY_TABLE_KEYS = [
  'checklist_items', 'schedule_events', 'vendors', 'expenses', 'expense_options',
  'expense_splits', 'payments', 'area_budgets', 'guests', 'photos',
] as const;

// ── 빌드(내보내기) ──────────────────────────────────────────────────────────

// 스냅샷 → 백업 파일. share_code 제거, area UUID→area_code 보강, 버전/시각 주입.
// areas: id→code 매핑용 전역 area 목록. now: 내보낸 시각.
export function buildBackup(snapshot: CoupleSnapshot, areas: Area[], now: Date): BackupFile {
  const codeById = new Map<string, AreaCode>(areas.map((a) => [a.id, a.code]));
  const codeOf = (areaId: string | null): AreaCode | null =>
    areaId == null ? null : codeById.get(areaId) ?? null;

  // couple에서 share_code만 제거(접속 비밀은 백업에 담지 않는다 — ADR-0009).
  const { share_code: _omit, ...coupleNoCode } = snapshot.couple;

  return {
    app: BACKUP_APP,
    schema_version: BACKUP_SCHEMA_VERSION,
    db_schema: BACKUP_DB_SCHEMA,
    exported_at: now.toISOString(),
    data: {
      couple: coupleNoCode,
      checklist_items: snapshot.checklist_items.map((r) => ({ ...r, area_code: codeOf(r.area_id) })),
      schedule_events: snapshot.schedule_events.map((r) => ({ ...r, area_code: codeOf(r.area_id) })),
      vendors: snapshot.vendors.map((r) => ({ ...r, area_code: codeOf(r.area_id) })),
      expenses: snapshot.expenses.map((r) => ({ ...r, area_code: codeOf(r.area_id) })),
      expense_options: [...snapshot.expense_options],
      expense_splits: [...snapshot.expense_splits],
      payments: [...snapshot.payments],
      area_budgets: snapshot.area_budgets.map((r) => ({ ...r, area_code: codeOf(r.area_id) })),
      guests: [...snapshot.guests],
      photos: snapshot.photos.map((r) => ({ ...r, area_code: codeOf(r.area_id) })),
    },
  };
}

// ── 파싱(가져오기) ──────────────────────────────────────────────────────────

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// data가 11개 키를 올바른 형태(couple 객체 + 10개 배열)로 가졌는지 방어적 검증.
function isValidData(data: unknown): data is BackupData {
  if (!isPlainObject(data)) return false;
  if (!isPlainObject(data.couple)) return false;
  for (const key of ARRAY_TABLE_KEYS) {
    if (!Array.isArray(data[key])) return false;
  }
  return true;
}

// 원시 파싱 결과(JSON.parse 산출물) → 검증된 BackupFile 또는 실패 사유.
// app 마커가 없거나 다르면 NOT_BACKUP(우리 백업이 아님), app은 맞지만 구조가 깨졌으면 MALFORMED.
export function parseBackup(raw: unknown): ParseResult {
  if (!isPlainObject(raw)) return { ok: false, reason: 'NOT_BACKUP' };
  if (raw.app !== BACKUP_APP) return { ok: false, reason: 'NOT_BACKUP' };

  const version = raw.schema_version;
  if (typeof version !== 'number' || !Number.isInteger(version)) {
    return { ok: false, reason: 'MALFORMED' };
  }
  if (version > BACKUP_SCHEMA_VERSION) return { ok: false, reason: 'VERSION_TOO_NEW' };
  if (version < BACKUP_MIN_READABLE) return { ok: false, reason: 'VERSION_TOO_OLD' };

  if (!isValidData(raw.data)) return { ok: false, reason: 'MALFORMED' };

  const rawFile: BackupFile = {
    app: BACKUP_APP,
    schema_version: version,
    db_schema: typeof raw.db_schema === 'string' ? raw.db_schema : BACKUP_DB_SCHEMA,
    exported_at: typeof raw.exported_at === 'string' ? raw.exported_at : '',
    data: raw.data,
  };

  const warnings: string[] = [];
  const file = migrateBackup(rawFile);
  if (version !== BACKUP_SCHEMA_VERSION) {
    warnings.push(`구버전 백업(v${version})을 현재 형식(v${BACKUP_SCHEMA_VERSION})으로 변환했습니다.`);
  }
  return { ok: true, file, warnings };
}

// 구버전 백업을 현재 포맷으로 승급한다. 현재 포맷 버전은 1뿐이라 실제 변환 단계가 없는 no-op 스텁.
// v2를 추가하면 여기에 변환 체인을 넣는다:
//   if (file.schema_version === 1) file = migrateV1toV2(file);
//   if (file.schema_version === 2) file = migrateV2toV3(file); ...
export function migrateBackup(file: BackupFile): BackupFile {
  if (file.schema_version === BACKUP_SCHEMA_VERSION) return file;
  // 아직 실제 포맷 차이가 없어 버전 라벨만 현재로 올려 받아들인다.
  return { ...file, schema_version: BACKUP_SCHEMA_VERSION };
}

// 미리보기용 테이블별 건수. couple은 항상 1이라 제외하고 배열 테이블만 센다.
export function countRows(data: BackupData): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const key of ARRAY_TABLE_KEYS) {
    counts[key] = data[key].length;
  }
  return counts;
}

// 테이블 키의 한국어 라벨(미리보기 UI 표시용).
export const TABLE_LABEL: Record<(typeof ARRAY_TABLE_KEYS)[number], string> = {
  checklist_items: '체크리스트',
  schedule_events: '일정',
  vendors: '업체',
  expenses: '지출',
  expense_options: '지출 옵션',
  expense_splits: '분담',
  payments: '납부',
  area_budgets: '영역별 예산',
  guests: '하객',
  photos: '사진',
};

export { ARRAY_TABLE_KEYS, AREA_TABLE_KEYS };
