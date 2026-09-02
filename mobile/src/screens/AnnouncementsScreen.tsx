import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { api, ApiError } from '@/lib/api';
import { colors } from '@/lib/theme';

type AnnouncementPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

type Announcement = {
  id: string;
  title: string;
  body: string;
  priority: AnnouncementPriority;
};

const PRIORITY_STYLE: Record<AnnouncementPriority, { bg: string; fg: string }> = {
  URGENT: { bg: colors.dangerBg, fg: colors.danger },
  HIGH: { bg: colors.warningBg, fg: colors.warning },
  NORMAL: { bg: '#f1f5f9', fg: colors.textMuted },
  LOW: { bg: '#f1f5f9', fg: colors.textMuted },
};

export default function AnnouncementsScreen() {
  const [items, setItems] = useState<Announcement[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api.get<Announcement[]>('/announcements');
      setItems(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.body?.message ?? err.message : 'Could not load announcements.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (items === null) {
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
      data={items}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      ListHeaderComponent={error ? <Text style={styles.errorText}>{error}</Text> : null}
      ListEmptyComponent={<Text style={styles.empty}>No announcements yet.</Text>}
      renderItem={({ item }) => {
        const s = PRIORITY_STYLE[item.priority];
        return (
          <View style={styles.card}>
            <View style={[styles.badge, { backgroundColor: s.bg }]}>
              <Text style={[styles.badgeText, { color: s.fg }]}>{item.priority}</Text>
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  errorText: { color: colors.danger, marginBottom: 10 },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 40 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start', marginBottom: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  body: { fontSize: 14, color: colors.textMuted, marginTop: 4, lineHeight: 20 },
});
