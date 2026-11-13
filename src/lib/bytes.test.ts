import { formatBytes } from './bytes';

describe('formatBytes', () => {
  test('0 이하는 "0MB"', () => {
    expect(formatBytes(0)).toBe('0MB');
    expect(formatBytes(-5)).toBe('0MB');
  });
  test('1000MB 미만은 MB, 소수 한 자리', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.0MB');
    expect(formatBytes(2.4 * 1024 * 1024)).toBe('2.4MB');
  });
  test('1000MB 이상은 GB, 소수 한 자리', () => {
    expect(formatBytes(2.4 * 1024 * 1024 * 1024)).toBe('2.4GB');
  });
});
