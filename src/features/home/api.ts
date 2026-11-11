import { toTimelineItem } from '@/features/schedule/api';
import type { Couple, CoupleSnapshot } from '@/types/db';
import type { HomeFeedItem } from './types';

// 코어(순수) — RN/expo UI를 import하지 않는다. 홈은 세 도메인의 집계 뷰라 홈 고유 로직은
// 통합 피드 셀렉터 하나뿐이고, D-day·진행률·소비율은 기존 셀렉터(selectDDay·overallPercent·
// selectBudgetSummary)를 화면에서 직접 재사용한다.
//
// schedule/api의 toTimelineItem을 재사용한다(일정→TimelineItem 변환은 schedule 고유 로직).
// 배럴(@/features/schedule)이 아니라 api 파일을 직접 import해 순수성을 유지한다 — 배럴은 hooks를
// 재export해 RN이 딸려온다. schedule/api는 home/api를 import하지 않아 순환도 없다.

function compareByDate(a: HomeFeedItem, b: HomeFeedItem): number {
  if (a.date === b.date) return 0;
  if (a.date === null) return 1; // 날짜 미정은 뒤로
  if (b.date === null) return -1;
  return a.date < b.date ? -1 : 1; // date-only 문자열은 사전식 비교로 충분
}

// 읽기: "다가오는 일정·할 일" 통합 피드. 미완료 체크리스트 + 모든 일정(완료 개념 없음)을 날짜
// 오름차순으로 병합(날짜 미정은 맨 뒤), 상위 limit개. 과거(지남) 항목도 포함한다(사용자 결정
// 2026-11-11 — 지남 칩이 경고를 나르고, 놓치면 안 되는 할 일을 가린다). 날짜순이라 지난 것이 위.
// today 주입이 필요 없다(과거 필터링 없음, 상태 칩은 행 컴포넌트가 자체 판정). 원본 배열 불변.
export function selectUpcomingFeed(snapshot: CoupleSnapshot, limit = 4): HomeFeedItem[] {
  const checklist: HomeFeedItem[] = snapshot.checklist_items
    .filter((i) => !i.is_done)
    .map((item) => ({ kind: 'CHECKLIST', date: item.due_date, item }));
  const events: HomeFeedItem[] = snapshot.schedule_events.map((e) => ({
    kind: 'EVENT',
    date: e.event_date,
    item: toTimelineItem(e),
  }));
  return [...checklist, ...events].sort(compareByDate).slice(0, limit);
}

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'] as const;

function formatTimeKo(time: string): string {
  const [hStr, mStr] = time.split(':');
  let h = Number(hStr);
  const m = Number(mStr);
  const period = h < 12 ? '오전' : '오후';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return m === 0 ? `${period} ${h}시` : `${period} ${h}시 ${m}분`;
}

// 읽기: 홈 마스트헤드의 날짜·시간·장소 한 줄("2027. 5. 15 (토) 오후 1시 · 그랜드컨벤션 그랜드홀").
// 예식일 미정(UNDECIDED 또는 wedding_date 없음)이면 null — 호출부가 메타 줄을 숨긴다.
export function formatWeddingMeta(
  couple: Pick<Couple, 'wedding_date' | 'wedding_date_status' | 'wedding_time' | 'venue'>,
): string | null {
  if (couple.wedding_date_status === 'UNDECIDED' || !couple.wedding_date) return null;
  const d = new Date(`${couple.wedding_date}T00:00:00`);
  const dateLabel = `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()} (${WEEKDAY_KO[d.getDay()]})`;
  const timeLabel = couple.wedding_time ? formatTimeKo(couple.wedding_time) : null;
  const main = [dateLabel, timeLabel].filter((v): v is string => !!v).join(' ');
  return couple.venue ? `${main} · ${couple.venue}` : main;
}
