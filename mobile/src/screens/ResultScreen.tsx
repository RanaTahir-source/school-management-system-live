import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { api, ApiError } from '@/lib/api';
import { useMyStudent } from '@/lib/useMyStudent';
import { colors } from '@/lib/theme';

type Exam = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
};

export default function ResultScreen() {
  const { student, loading: studentLoading, error: studentError } = useMyStudent();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api.get<Exam[]>('/exams');
      setExams(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.body?.message ?? err.message : 'Could not load exams');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function viewReportCard(exam: Exam) {
    if (!student) return;
    setOpening(exam.id);
    try {
      await api.openOrSharePdf(
        `/results/report-card/${student.id}/pdf?examId=${exam.id}`,
        `report-card-${student.admissionNo}-${exam.name.replace(/\s+/g, '-')}.pdf`,
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

  if (studentLoading || (loading && !refreshing)) {
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
    <FlatList
      style={styles.container}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      data={exams}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      ListHeaderComponent={error ? <Text style={styles.errorText}>{error}</Text> : null}
      ListEmptyComponent={!error ? <Text style={styles.empty}>No exams published yet.</Text> : null}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={{ flex: 1 }}>
            <Text style={styles.examName}>{item.name}</Text>
            <Text style={styles.examDates}>
              {new Date(item.startDate).toLocaleDateString()} - {new Date(item.endDate).toLocaleDateString()}
            </Text>
          </View>
          <TouchableOpacity style={styles.button} onPress={() => viewReportCard(item)} disabled={opening === item.id}>
            {opening === item.id ? (
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
