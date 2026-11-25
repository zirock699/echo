// Request bytes include the revision wrapper. Backup files may still use the
// older, indented JSON export format, so the file-read limit is separate.
export const MAX_STATE_BYTES = 16_000_000;
export const MAX_BACKUP_BYTES = 64_000_000;
export const MAX_ROW_BYTES = 1_950_000;
