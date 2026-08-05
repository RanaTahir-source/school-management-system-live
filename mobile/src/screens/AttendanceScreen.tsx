import { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { api, ApiError } from '@/lib/api';
import { useMyStudent } from '@/lib/useMyStudent';
import { colors } from '@/lib/theme';

type AttendanceRecord = {
  id: string;
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE';
  remarks: string | null;
};

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  PRESENT: { bg: colors.successBg, text: colors.success, label: 'Present' },
  ABSENT: { bg: colors.dangerBg, text: colors.danger, label: 'Absent' },
  LATE: { bg: colors.warningBg, text: colors.warning, label: 'Late' },
  LEAVE: { bg: '#E7EEF6', text: '#2A5D8A', label: 'Leave' },
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function monthRange(year: number, month: number) {
  const from = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  const to = new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);
  return { from, to };
}

export default function AttendanceScreen() {
  const { student, loading: studentLoading, error: studentError } = useMyStudent();
  const now = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { from, to } = monthRange(cursor.year, cursor.month);

  const load = useCallback(async () => {
    if (!student) return;
    setError(null);
    try {
      const data = await api.get<AttendanceRecord[]>(`/attendance/student/${student.id}`, { from, to });
      setRecords(data.sort((a, b) => (a.date < b.date ? 1 : -1)));
    } catch (err) {
      setError(err instanceof ApiError ? err.body?.message ?? err.message : 'Could not load attendance');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [student, from, to]);

  useEffect(() => {
    setLoading(true);
    if (student) load();
  }, [student, cursor.year, cursor.month, load]);

  const counts = useMemo(() => {
    const c = { PRESENT: 0, ABSENT: 0, LATE: 0, LEAVE: 0 };
    records.forEach((r) => {
      if (c[r.status] !== undefined) c[r.status]++;
    });
    const marked = records.length;
    const presentPct = marked ? Math.round(((c.PRESENT + c.LATE) / marked) * 100) : null;
    return { ...c, marked, presentPct };
  }, [records]);

  if (studentLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }
  if (studentError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{studentError}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.monthBar}>
        <TouchableOpacity onPress={() => setCursor((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 }))}>
          <Text style={styles.monthArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{MONTH_NAMES[cursor.month]} {cursor.year}</Text>
        <TouchableOpacity onPress={() => setCursor((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 }))}>
          <Text style={styles.monthArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.summary}>
        <SummaryChip label="Present" value={counts.PRESENT} color={colors.success} />
        <SummaryChip label="Absent" value={counts.ABSENT} color={colors.danger} />
        <SummaryChip label="Late" value={counts.LATE} color={colors.warning} />
        <SummaryChip label="Leave" value={counts.LEAVE} color="#2A5D8A" />
      </View>
      {counts.presentPct !== null && (
        <Text style={styles.pct}>{counts.presentPct}% attendance this month</Text>
      )}

      <FlatList
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        data={records}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListEmptyComponent={
          loading ? null : !error ? <Text style={styles.empty}>No attendance marked for this month.</Text> : <Text style={styles.errorText}>{error}</Text>
        }
        renderItem={({ item }) => {
          const s = STATUS_STYLE[item.status];
          return (
            <View style={styles.row}>
              <Text style={styles.date}>{new Date(item.date).toDateString()}</Text>
              <View style={[styles.badge, { backgroundColor: s.bg }]}>
                <Text style={[styles.badgeText, { color: s.text }]}>{s.label}</Text>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

function SummaryChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.chip}>
      <Text style={[styles.chipValue, { color }]}>{value}</Text>
      <Text style={styles.chipLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg, padding: 20 },
  errorText: { color: colors.danger, textAlign: 'center' },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 40 },
  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, paddingTop: 16, paddingBottom: 8 },
  monthArrow: { fontSize: 26, color: colors.green, fontWeight: '700', paddingHorizontal: 12 },
  monthLabel: { fontSize: 15, fontWeight: '700', color: colors.text, minWidth: 150, textAlign: 'center' },
  summary: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 16, marginTop: 4 },
  chip: { alignItems: 'center', backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingVertical: 10, flex: 1, marginHorizontal: 4 },
  chipValue: { fontSize: 18, fontWeight: '700' },
  chipLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  pct: { textAlign: 'center', color: colors.textMuted, fontSize: 12, marginTop: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.card, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 12, marginBottom: 8 },
  date: { fontSize: 13, color: colors.text },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '700' },
});
