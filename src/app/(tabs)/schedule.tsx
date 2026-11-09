import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Fab, PageHead, Segmented, Text } from '@/components/ui';
import { colors, layout, spacing } from '@/constants/theme';
import { useCouple } from '@/features/couple';
import {
  selectAgenda, selectAgendaByArea, selectDDay, selectEventsOnDate, selectMarkersByDate,
  todayDateString, toTimelineItem,
  useCreateScheduleEvent, useDeleteScheduleEvent, useSchedule, useUpdateScheduleEvent,
} from '@/features/schedule';
import { AgendaView } from '@/features/schedule/components/agenda-view';
import { AreaAgendaView } from '@/features/schedule/components/area-agenda-view';
import { CalendarView } from '@/features/schedule/components/calendar-view';
import { EventRow } from '@/features/schedule/components/event-row';
import { ScheduleForm, type ScheduleFormValue } from '@/features/schedule/components/schedule-form';
import { useAreas } from '@/hooks/use-areas';
import { useAuspiciousDays } from '@/hooks/use-auspicious-days';
import type { ScheduleEvent } from '@/types/db';

export default function ScheduleScreen() {
  const { data: events = [] } = useSchedule();
  const { data: areas = [] } = useAreas();
  const { data: auspiciousDays = [] } = useAuspiciousDays();
  const { data: couple } = useCouple();
  const create = useCreateScheduleEvent();
  const update = useUpdateScheduleEvent();
  const remove = useDeleteScheduleEvent();

  const today = todayDateString();
  const [view, setView] = useState<'cal' | 'list'>('cal');
  const [listView, setListView] = useState<'date' | 'area'>('date');
  const [selectedDate, setSelectedDate] = useState(today);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleEvent | null>(null);
  // 열 때마다 증가시켜 ScheduleForm을 리마운트(ChecklistForm과 동일한 이유 — visible만 토글하면
  // 내부 state에 이전 입력이 남는다).
  const [formKey, setFormKey] = useState(0);

  const agenda = useMemo(() => selectAgenda(events), [events]);
  const agendaByArea = useMemo(() => selectAgendaByArea(events, areas), [events, areas]);
  const markersByDate = useMemo(() => selectMarkersByDate(events), [events]);
  const dayItems = useMemo(
    () => selectEventsOnDate(events, selectedDate).map(toTimelineItem),
    [events, selectedDate],
  );
  const auspiciousDates = useMemo(() => new Set(auspiciousDays.map((d) => d.day)), [auspiciousDays]);
  const dday = couple ? selectDDay(couple.wedding_date, today) : null;

  const openAdd = () => { setEditing(null); setFormKey((k) => k + 1); setFormOpen(true); };
  const openEdit = (id: string) => {
    const found = events.find((e) => e.id === id) ?? null;
    setEditing(found);
    setFormKey((k) => k + 1);
    setFormOpen(true);
  };
  const closeForm = () => setFormOpen(false);

  const submitForm = (v: ScheduleFormValue) => {
    if (editing) {
      update.mutate({
        id: editing.id, title: v.title, eventDate: v.eventDate, eventTime: v.eventTime,
        location: v.location, assignee: v.assignee, category: v.category,
      });
    } else {
      create.mutate(v);
    }
    closeForm();
  };
  const deleteCurrent = () => {
    if (editing) remove.mutate({ id: editing.id });
    closeForm();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.ground }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: layout.screenPadding, paddingTop: spacing.lg, paddingBottom: layout.tabBarHeight + 80 }}>
        <PageHead
          title="일정"
          sub={couple ? `${couple.groom_name} & ${couple.bride_name}` : undefined}
          dday={dday !== null ? `D-${dday}` : undefined}
        />

        <View style={{ marginTop: spacing.lg }}>
          <Segmented
            options={[{ key: 'cal', label: '캘린더' }, { key: 'list', label: '리스트' }]}
            value={view}
            onChange={(k) => setView(k as 'cal' | 'list')}
          />
        </View>

        {view === 'cal' ? (
          <View style={{ marginTop: spacing.xl }}>
            <CalendarView
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              markersByDate={markersByDate}
              auspiciousDates={couple?.show_auspicious_days ? auspiciousDates : new Set()}
              todayStr={today}
            />
            <View style={{ marginTop: spacing.xl }}>
              <Text variant="titleSm" style={{ marginBottom: spacing.sm }}>
                {selectedDate === today ? '오늘 일정' : `${selectedDate} 일정`}
              </Text>
              {dayItems.length === 0 ? (
                <Text variant="body" color="inkMuted">등록된 일정이 없습니다.</Text>
              ) : (
                dayItems.map((item, idx) => (
                  <EventRow key={item.id} item={item} first={idx === 0} areas={areas} onPress={() => openEdit(item.id)} />
                ))
              )}
            </View>
          </View>
        ) : (
          <View style={{ marginTop: spacing.xl }}>
            <Segmented
              options={[{ key: 'date', label: '날짜순' }, { key: 'area', label: '영역별' }]}
              value={listView}
              onChange={(k) => setListView(k as 'date' | 'area')}
            />
            <View style={{ marginTop: spacing.lg }}>
              {listView === 'date' ? (
                <AgendaView groups={agenda} areas={areas} onEdit={openEdit} />
              ) : (
                <AreaAgendaView groups={agendaByArea} areas={areas} onEdit={openEdit} />
              )}
            </View>
          </View>
        )}

        {couple?.wedding_date_status === 'UNDECIDED' ? (
          <View style={{
            marginTop: spacing.xxxl, padding: spacing.lg,
            borderWidth: 1, borderColor: colors.lineStrong, borderStyle: 'dashed', borderRadius: 10,
          }}>
            <Text variant="caption" color="inkMuted">예식일을 아직 정하지 않으셨나요?</Text>
            <Text variant="body" color="inkMuted" style={{ marginTop: spacing.sm }}>
              날짜를 입력하지 않아도 일정을 자유롭게 기록할 수 있어요.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <Fab label="일정 추가" onPress={openAdd} />

      <ScheduleForm
        key={formKey}
        visible={formOpen}
        areas={areas}
        editing={editing}
        defaultAreaId={null}
        onSubmit={submitForm}
        onDelete={editing ? deleteCurrent : undefined}
        onClose={closeForm}
      />
    </SafeAreaView>
  );
}
