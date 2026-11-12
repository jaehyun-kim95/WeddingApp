import { Segmented } from '@/components/ui';
import type { GuestSide } from '@/types/db';
import { SIDE_LABEL } from '../api';

// 측 필터(전체/신랑측/신부측). Segmented 재사용 — 목업의 filter-scroll 세그먼트를 그대로 옮긴다.
export type SideFilterValue = 'ALL' | GuestSide;

const OPTIONS: { key: SideFilterValue; label: string }[] = [
  { key: 'ALL', label: '전체' },
  { key: 'GROOM', label: SIDE_LABEL.GROOM },
  { key: 'BRIDE', label: SIDE_LABEL.BRIDE },
];

export function SideSegmented({
  value, onChange,
}: {
  value: SideFilterValue;
  onChange: (v: SideFilterValue) => void;
}) {
  return (
    <Segmented
      options={OPTIONS}
      value={value}
      onChange={(k) => onChange(k as SideFilterValue)}
    />
  );
}
