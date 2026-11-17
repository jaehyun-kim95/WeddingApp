// backup 도메인 공개 API(배럴).
export {
  BACKUP_SCHEMA_VERSION, BACKUP_MIN_READABLE, BACKUP_DB_SCHEMA,
  buildBackup, parseBackup, migrateBackup, countRows, TABLE_LABEL,
} from './backup-format';
export type { BackupFile, BackupData, ParseResult, ParseFailReason } from './backup-format';
// RN I/O 글루(여기만 expo-document-picker/expo-file-system/expo-sharing을 import).
export { exportBackup, pickAndParseBackup } from './backup-io';
export { useRestoreBackup } from './hooks';
export { BackupImportPreview } from './components/backup-import-preview';
