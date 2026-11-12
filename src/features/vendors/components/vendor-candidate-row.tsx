import { Chip, ListRow, Text } from '@/components/ui';
import { formatMan } from '@/lib/money';
import type { Vendor } from '@/types/db';
import { ROLE_LABEL } from '../api';

// 후보(검토 중) 리스트 행(목업 `.list .quote`) — ListRow 재사용. 탭하면 수정 모달(계약 확정 버튼 포함).
// first: 호출부가 그룹 내 첫 행인지 알려줘 ListRow의 상단 헤어라인을 생략한다(목록 최상단 중복 괘선 방지).
export function VendorCandidateRow({
  vendor, onPress, first,
}: { vendor: Vendor; onPress: () => void; first?: boolean }) {
  return (
    <ListRow
      title={vendor.name}
      subtitle={vendor.location ?? undefined}
      left={<Chip variant="ghost" label={vendor.role ? ROLE_LABEL[vendor.role] : '후보'} />}
      right={
        vendor.quoted_price != null ? (
          <Text variant="titleSm" tabularNums>{formatMan(vendor.quoted_price)}</Text>
        ) : undefined
      }
      onPress={onPress}
      first={first}
    />
  );
}
