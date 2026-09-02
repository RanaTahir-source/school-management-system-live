import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { api, ApiError } from '@/lib/api';
import { colors } from '@/lib/theme';

type TeacherProfile = {
  id: string;
  employeeId: string;
  subjectSpecialty?: string | null;
  isActive: boolean;
  user: { fullName: string; email: string; phone?: string | null };
};

export default function StaffDirectoryScreen() {
  const [teachers, setTeachers] = useState<TeacherProfile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api.get<TeacherProfile[]>('/teachers');
      setTeachers(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.body?.message ?? err.message : 'Could not load the staff directory.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (teachers === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }

  const q = search.trim().toLowerCase();
  const filtered = teachers.filter((t) => !q || t.user.fullName.toLowerCase().includes(q) || t.employeeId.toLowerCase().includes(q));

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        value={search}
        onChangeText={setSearch}
        placeholder="Search by name or employee ID"
        placeholderTextColor="#9AA8A1"
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListEmptyComponent={<Text style={styles.empty}>No teachers found.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.name}>{item.user.fullName}</Text>
              {!item.isActive ? <Text style={styles.inactiveTag}>Inactive</Text> : null}
            </View>
            <Text style={styles.meta}>Employee ID: {item.employeeId}</Text>
            {item.subjectSpecialty ? <Text style={styles.meta}>Subject: {item.subjectSpecialty}</Text> : null}
            <Text style={styles.meta}>{item.user.email}</Text>
            {item.user.phone ? <Text style={styles.meta}>{item.user.phone}</Text> : null}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  errorText: { color: colors.danger, marginBottom: 10 },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 40 },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    marginBottom: 12,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 10,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 15, fontWeight: '600', color: colors.text },
  inactiveTag: { fontSize: 11, fontWeight: '700', color: colors.danger },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
});
