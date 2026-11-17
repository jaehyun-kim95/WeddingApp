import type { Area, CoupleSnapshot } from '@/types/db';
import {
  BACKUP_APP, BACKUP_DB_SCHEMA, BACKUP_SCHEMA_VERSION, buildBackup, countRows, migrateBackup,
  parseBackup, type BackupFile,
} from './backup-format';

// 전역 area 6종(0001 시드와 동일한 code). id는 환경 임의값(복원 시 code로 재해소되므로 무의미).
const AREAS: Area[] = [
  { id: 'area-sdm', created_at: '', code: 'SDM', name_ko: '스드메', sort_order: 1 },
  { id: 'area-hall', created_at: '', code: 'HALL', name_ko: '웨딩홀', sort_order: 2 },
  { id: 'area-inv', created_at: '', code: 'INV', name_ko: '청첩장', sort_order: 3 },
  { id: 'area-gift', created_at: '', code: 'GIFT', name_ko: '예단예물', sort_order: 4 },
  { id: 'area-home', created_at: '', code: 'HOME', name_ko: '신혼집', sort_order: 5 },
  { id: 'area-guest', created_at: '', code: 'GUEST', name_ko: '하객', sort_order: 6 },
];

// 작은 CoupleSnapshot 픽스처 — 각 테이블 최소 1행 + area nullable 케이스 포함.
function sampleSnapshot(): CoupleSnapshot {
  return {
    couple: {
      id: 'couple-1', created_at: '2026-01-01T00:00:00.000Z', share_code: 'secret-code-123',
      groom_name: '김신랑', bride_name: '이신부', wedding_date: '2026-10-10',
      wedding_date_status: 'FIXED', wedding_time: '12:00:00', venue: '강남웨딩홀',
      show_auspicious_days: true, notify_payments: true, total_budget: 50000000, meal_price: 55000,
    },
    checklist_items: [
      {
        id: 'cl-1', created_at: '', couple_id: 'couple-1', area_id: 'area-sdm', title: '스튜디오 예약',
        assignee: 'BOTH', is_done: true, done_at: '2026-02-01T00:00:00.000Z', due_date: '2026-03-01',
        memo: null, origin: 'USER', sort_order: 0,
      },
    ],
    schedule_events: [
      {
        id: 'se-1', created_at: '', couple_id: 'couple-1', area_id: null, title: '상견례',
        event_date: '2026-04-01', event_time: '18:00:00', location: '한정식집', assignee: 'BOTH',
        category: 'IMPORTANT', reminder_at: null, origin: 'USER',
      },
    ],
    vendors: [
      {
        id: 've-1', created_at: '', couple_id: 'couple-1', area_id: 'area-hall', name: '강남웨딩홀',
        status: 'CONTRACTED', role: null, location: '서울 강남', contract_date: '2026-02-10',
        quoted_price: 12000000, memo: null,
      },
    ],
    expenses: [
      {
        id: 'ex-1', created_at: '', couple_id: 'couple-1', area_id: 'area-hall', vendor_id: 've-1',
        title: null, base_amount: 12000000,
      },
    ],
    expense_options: [
      { id: 'eo-1', created_at: '', couple_id: 'couple-1', expense_id: 'ex-1', name: '플라워 업그레이드', amount: 500000 },
    ],
    expense_splits: [
      { id: 'es-1', created_at: '', couple_id: 'couple-1', expense_id: 'ex-1', payer: 'BOTH_FAMILY', amount: 12500000 },
    ],
    payments: [
      {
        id: 'pa-1', created_at: '', couple_id: 'couple-1', expense_id: 'ex-1', kind: 'DEPOSIT',
        amount: 1000000, due_date: '2026-02-10', payer: 'ME', is_paid: true, paid_at: '2026-02-10T00:00:00.000Z',
      },
    ],
    area_budgets: [
      { id: 'ab-1', created_at: '', couple_id: 'couple-1', area_id: 'area-hall', amount: 13000000 },
    ],
    guests: [
      {
        id: 'gu-1', created_at: '', couple_id: 'couple-1', name: '박하객', side: 'GROOM', relation: 'FRIEND',
        attend_status: 'ATTENDING', is_host: false, meal_count: 2, gift_amount: 100000, memo: null,
      },
    ],
    photos: [
      {
        id: 'ph-1', created_at: '', couple_id: 'couple-1', area_id: null, storage_path: 'couple-1/a.jpg',
        external_url: null, is_video: false, caption: '본식', taken_at: null, size_bytes: 204800,
      },
    ],
  };
}

const NOW = new Date('2026-05-05T09:30:00.000Z');

describe('buildBackup', () => {
  test('share_code를 제거하고 버전/시각/db_schema를 주입한다', () => {
    const file = buildBackup(sampleSnapshot(), AREAS, NOW);
    expect(file.app).toBe(BACKUP_APP);
    expect(file.schema_version).toBe(BACKUP_SCHEMA_VERSION);
    expect(file.db_schema).toBe(BACKUP_DB_SCHEMA);
    expect(file.exported_at).toBe('2026-05-05T09:30:00.000Z');
    expect('share_code' in file.data.couple).toBe(false);
    // couple의 나머지 필드는 보존.
    expect(file.data.couple.groom_name).toBe('김신랑');
    expect(file.data.couple.total_budget).toBe(50000000);
  });

  test('area_id를 가진 행에 area_code를 동봉한다(nullable은 null)', () => {
    const file = buildBackup(sampleSnapshot(), AREAS, NOW);
    expect(file.data.checklist_items[0].area_code).toBe('SDM');
    expect(file.data.vendors[0].area_code).toBe('HALL');
    expect(file.data.expenses[0].area_code).toBe('HALL');
    expect(file.data.area_budgets[0].area_code).toBe('HALL');
    // area_id가 null인 행 → area_code도 null.
    expect(file.data.schedule_events[0].area_code).toBeNull();
    expect(file.data.photos[0].area_code).toBeNull();
  });

  test('매핑에 없는 area_id는 area_code null로 떨어진다(방어적)', () => {
    const snap = sampleSnapshot();
    snap.checklist_items[0].area_id = 'unknown-area';
    const file = buildBackup(snap, AREAS, NOW);
    expect(file.data.checklist_items[0].area_code).toBeNull();
  });

  test('원본 스냅샷을 변형하지 않는다(불변)', () => {
    const snap = sampleSnapshot();
    buildBackup(snap, AREAS, NOW);
    expect('share_code' in snap.couple).toBe(true);
    expect('area_code' in snap.checklist_items[0]).toBe(false);
  });
});

describe('왕복 무손실(round-trip)', () => {
  test('buildBackup → JSON 왕복 → parseBackup이 share_code 제외 deep-equal(area_code 포함)', () => {
    const built = buildBackup(sampleSnapshot(), AREAS, NOW);
    const roundTripped = JSON.parse(JSON.stringify(built));
    const result = parseBackup(roundTripped);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toEqual([]);
    expect(result.file).toEqual(built);
    // 동봉된 area_code가 왕복 후에도 유지.
    expect(result.file.data.vendors[0].area_code).toBe('HALL');
    // share_code는 끝까지 없다.
    expect('share_code' in result.file.data.couple).toBe(false);
  });
});

describe('parseBackup — 버전 게이팅', () => {
  test('미래 버전 → VERSION_TOO_NEW', () => {
    const file = buildBackup(sampleSnapshot(), AREAS, NOW);
    const future = { ...file, schema_version: BACKUP_SCHEMA_VERSION + 1 };
    const result = parseBackup(future);
    expect(result).toEqual({ ok: false, reason: 'VERSION_TOO_NEW' });
  });

  test('너무 오래된 버전(음수) → VERSION_TOO_OLD', () => {
    const file = buildBackup(sampleSnapshot(), AREAS, NOW);
    const ancient = { ...file, schema_version: -1 };
    const result = parseBackup(ancient);
    expect(result).toEqual({ ok: false, reason: 'VERSION_TOO_OLD' });
  });

  test('직전 버전(v0) → migrateBackup 승급 + 경고', () => {
    const file = buildBackup(sampleSnapshot(), AREAS, NOW);
    const old = { ...file, schema_version: 0 };
    const result = parseBackup(old);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.schema_version).toBe(BACKUP_SCHEMA_VERSION);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe('parseBackup — app 마커', () => {
  test('app 불일치 → NOT_BACKUP', () => {
    const file = buildBackup(sampleSnapshot(), AREAS, NOW);
    const result = parseBackup({ ...file, app: 'other-app' });
    expect(result).toEqual({ ok: false, reason: 'NOT_BACKUP' });
  });

  test('정상 백업 → ok:true(오탐 방지)', () => {
    const file = buildBackup(sampleSnapshot(), AREAS, NOW);
    const result = parseBackup(JSON.parse(JSON.stringify(file)));
    expect(result.ok).toBe(true);
  });
});

describe('parseBackup — 병리 입력', () => {
  test('null → NOT_BACKUP', () => {
    expect(parseBackup(null)).toEqual({ ok: false, reason: 'NOT_BACKUP' });
  });
  test('숫자 → NOT_BACKUP', () => {
    expect(parseBackup(42)).toEqual({ ok: false, reason: 'NOT_BACKUP' });
  });
  test('배열 → NOT_BACKUP', () => {
    expect(parseBackup([])).toEqual({ ok: false, reason: 'NOT_BACKUP' });
  });
  test('빈 객체 → NOT_BACKUP(app 마커 없음)', () => {
    expect(parseBackup({})).toEqual({ ok: false, reason: 'NOT_BACKUP' });
  });
  test('app은 맞지만 schema_version 누락 → MALFORMED', () => {
    expect(parseBackup({ app: BACKUP_APP })).toEqual({ ok: false, reason: 'MALFORMED' });
  });
  test('app은 맞지만 schema_version이 정수 아님 → MALFORMED', () => {
    expect(parseBackup({ app: BACKUP_APP, schema_version: 1.5, data: {} })).toEqual({ ok: false, reason: 'MALFORMED' });
  });
  test('app·버전은 맞지만 data 누락 → MALFORMED', () => {
    expect(parseBackup({ app: BACKUP_APP, schema_version: 1 })).toEqual({ ok: false, reason: 'MALFORMED' });
  });
  test('부분 번들(일부 테이블 배열 누락) → MALFORMED', () => {
    const file = buildBackup(sampleSnapshot(), AREAS, NOW);
    const partial = { ...file, data: { couple: file.data.couple, guests: file.data.guests } };
    expect(parseBackup(partial)).toEqual({ ok: false, reason: 'MALFORMED' });
  });
  test('테이블이 배열이 아님(타입 깨짐) → MALFORMED', () => {
    const file = buildBackup(sampleSnapshot(), AREAS, NOW);
    const broken = { ...file, data: { ...file.data, guests: '하객아님' } };
    expect(parseBackup(broken)).toEqual({ ok: false, reason: 'MALFORMED' });
  });
  test('couple이 객체가 아님 → MALFORMED', () => {
    const file = buildBackup(sampleSnapshot(), AREAS, NOW);
    const broken = { ...file, data: { ...file.data, couple: null } };
    expect(parseBackup(broken)).toEqual({ ok: false, reason: 'MALFORMED' });
  });
});

describe('countRows', () => {
  test('테이블별 건수를 정확히 센다', () => {
    const file = buildBackup(sampleSnapshot(), AREAS, NOW);
    const counts = countRows(file.data);
    expect(counts).toEqual({
      checklist_items: 1, schedule_events: 1, vendors: 1, expenses: 1, expense_options: 1,
      expense_splits: 1, payments: 1, area_budgets: 1, guests: 1, photos: 1,
    });
  });

  test('빈 스냅샷은 전부 0', () => {
    const empty: CoupleSnapshot = {
      ...sampleSnapshot(),
      checklist_items: [], schedule_events: [], vendors: [], expenses: [], expense_options: [],
      expense_splits: [], payments: [], area_budgets: [], guests: [], photos: [],
    };
    const file = buildBackup(empty, AREAS, NOW);
    const counts = countRows(file.data);
    expect(Object.values(counts).every((n) => n === 0)).toBe(true);
  });
});

describe('migrateBackup', () => {
  test('현재 버전은 그대로 반환(no-op)', () => {
    const file = buildBackup(sampleSnapshot(), AREAS, NOW);
    expect(migrateBackup(file)).toBe(file);
  });
  test('구버전은 schema_version만 현재로 올린다', () => {
    const file: BackupFile = { ...buildBackup(sampleSnapshot(), AREAS, NOW), schema_version: 0 };
    const migrated = migrateBackup(file);
    expect(migrated.schema_version).toBe(BACKUP_SCHEMA_VERSION);
    expect(migrated.data).toEqual(file.data);
  });
});
