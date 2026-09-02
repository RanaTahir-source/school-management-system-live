import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { api, ApiError } from '@/lib/api';
import { colors } from '@/lib/theme';

type TimetableSlot = {
  id: string;
  dayOfWeek: number; // 1=Monday .. 7=Sunday
  periodNo: number;
  startTime: string;
  endTime: string;
  room: string | null;
  subject?: { name: string };
  section?: { name: string; class?: { name: string } };
};

const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function TimetableScreen() {
  const [slots, setSlots] = useState<TimetableSlot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api.get<TimetableSlot[]>('/timetable/mine');
      setSlots(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.body?.message ?? err.message : 'Could not load your timetable.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const byDay = new Map<number, TimetableSlot[]>();
  for (const s of slots ?? []) {
    const list = byDay.get(s.dayOfWeek) ?? [];
    list.push(s);
    byDay.set(s.dayOfWeek, list);
  }

  if (slots === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {slots.length === 0 ? (
        <Text style={styles.empty}>No timetable slots assigned yet.</Text>
      ) : (
        [1, 2, 3, 4, 5, 6, 7]
          .filter((d) => byDay.has(d))
          .map((day) => (
            <View key={day} style={{ marginBottom: 16 }}>
              <Text style={styles.dayHeading}>{DAY_NAMES[day]}</Text>
              {(byDay.get(day) ?? [])
                .sort((a, b) => a.periodNo - b.periodNo)
                .map((s) => (
                  <View key={s.id} style={styles.card}>
                    <Text style={styles.period}>
                      Period {s.periodNo} · {s.startTime}–{s.endTime}
                    </Text>
                    <Text style={styles.meta}>
                      {s.subject?.name} · {s.section?.class?.name} {s.section?.name}
                      {s.room ? ` · Room ${s.room}` : ''}
                    </Text>
                  </View>
                ))}
            </View>
          ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  errorText: { color: colors.danger, marginBottom: 12 },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 40 },
  dayHeading: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 8 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 8,
  },
  period: { fontSize: 14, fontWeight: '600', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
});
