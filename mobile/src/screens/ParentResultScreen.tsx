import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api, ApiError } from '@/lib/api';
import { colors } from '@/lib/theme';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type ExamResult = {
  examId: string;
  examName: string;
  startDate: string;
  totalObtained: number;
  totalMax: number;
  percentage: number | null;
};

type Props = NativeStackScreenProps<RootStackParamList, 'ParentResult'>;

// Pulls the parent-portal's already-aggregated per-exam totals (no need to
// hit /exams separately like the student ResultScreen does), and reuses the
// same report-card PDF endpoint (now open to PARENT, ownership checked via
// ParentStudent on the backend).
export default function ParentResultScreen({ route }: Props) {
  const { studentId, studentAdmissionNo } = route.params;
  const [results, setResults] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api.get<ExamResult[]>(`/parent-portal/children/${studentId}/results`);
      setResults(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.body?.message ?? err.message : 'Could not load results');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [studentId]);

  useEffect(() => {
    load();
  }, [load]);

  async function viewReportCard(exam: ExamResult) {
    setOpening(exam.examId);
    try {
      await api.openOrSharePdf(
        `/results/report-card/${studentId}/pdf?examId=${exam.examId}`,
        `report-card-${studentAdmissionNo}-${exam.examName.replace(/\s+/g, '-')}.pdf`,
      );
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.body?.message ?? 'No results have been entered for this exam yet'
          : 'Could not open report card',
      );
    } finally {
      setOpening(null);
    }
  }

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      data={results}
      keyExtractor={(item) => item.examId}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      ListHeaderComponent={error ? <Text style={styles.errorText}>{error}</Text> : null}
      ListEmptyComponent={!error ? <Text style={styles.empty}>No exam results published yet.</Text> : null}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={{ flex: 1 }}>
            <Text style={styles.examName}>{item.examName}</Text>
            <Text style={styles.examDates}>
              {new Date(item.startDate).toLocaleDateString()} · {item.totalObtained}/{item.totalMax}
              {item.percentage !== null ? ` · ${item.percentage}%` : ''}
            </Text>
          </View>
          <TouchableOpacity style={styles.button} onPress={() => viewReportCard(item)} disabled={opening === item.examId}>
            {opening === item.examId ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Report Card</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg, padding: 20 },
  errorText: { color: colors.danger, textAlign: 'center', marginBottom: 12 },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 40 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  examName: { fontSize: 15, fontWeight: '700', color: colors.text },
  examDates: { fontSize: 12, color: colors.textMuted, marginTop: 3 },
  button: { backgroundColor: colors.green, borderRadius: 8, paddingVertical: 9, paddingHorizontal: 12 },
  buttonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
