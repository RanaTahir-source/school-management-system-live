import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { api, ApiError } from '@/lib/api';
import { colors } from '@/lib/theme';

type ChildLedger = {
  studentId: string;
  fullName: string;
  admissionNo: string;
  className: string | null;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  outstandingInvoices: number;
};

type FamilyLedger = {
  isFamily: boolean;
  children: ChildLedger[];
  totals: { totalAmount: number; paidAmount: number; balance: number };
};

// Combined fee view across every child linked to this parent - GET
// /parent-portal/family-ledger (added alongside per-child fee endpoints so a
// parent with 2+ kids can see one grand total instead of adding up screens).
export default function FamilyLedgerScreen() {
  const [data, setData] = useState<FamilyLedger | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await api.get<FamilyLedger>('/parent-portal/family-ledger');
      setData(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.body?.message ?? err.message : 'Could not load family ledger');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
      data={data?.children ?? []}
      keyExtractor={(item) => item.studentId}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      ListHeaderComponent={
        <>
          {error && <Text style={styles.errorText}>{error}</Text>}
          {data && (
            <View style={styles.totalsCard}>
              <Text style={styles.totalsTitle}>Family Total</Text>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Total Charged</Text>
                <Text style={styles.rowValue}>Rs. {data.totals.totalAmount.toLocaleString()}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Total Paid</Text>
                <Text style={styles.rowValue}>Rs. {data.totals.paidAmount.toLocaleString()}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.row}>
                <Text style={styles.totalLabel}>Balance Due</Text>
                <Text
                  style={[
                    styles.totalValue,
                    { color: data.totals.balance > 0 ? colors.danger : colors.success },
                  ]}
                >
                  Rs. {data.totals.balance.toLocaleString()}
                </Text>
              </View>
            </View>
          )}
        </>
      }
      ListEmptyComponent={!error ? <Text style={styles.empty}>No children linked to your account yet.</Text> : null}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.childName}>{item.fullName}</Text>
            {item.className && <Text style={styles.childMeta}>{item.className} · Adm# {item.admissionNo}</Text>}
          </View>
          <View style={styles.row}>
            <Text style={styles.childRowLabel}>Total Charged</Text>
            <Text style={styles.childRowValue}>Rs. {item.totalAmount.toLocaleString()}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.childRowLabel}>Paid</Text>
            <Text style={styles.childRowValue}>Rs. {item.paidAmount.toLocaleString()}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.childRowLabel}>Balance</Text>
            <Text style={[styles.childRowValue, { color: item.balance > 0 ? colors.danger : colors.success, fontWeight: '700' }]}>
              Rs. {item.balance.toLocaleString()}
            </Text>
          </View>
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
  totalsCard: {
    backgroundColor: colors.greenDark,
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
  },
  totalsTitle: { color: '#fff', fontSize: 13, fontWeight: '700', opacity: 0.85, marginBottom: 10 },
  card: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 12 },
  cardHeader: { marginBottom: 8 },
  childName: { fontSize: 15, fontWeight: '700', color: colors.text },
  childMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  rowLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  rowValue: { color: '#fff', fontSize: 13, fontWeight: '600' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.25)', marginVertical: 8 },
  totalLabel: { color: '#fff', fontSize: 14, fontWeight: '700' },
  totalValue: { fontSize: 16, fontWeight: '800' },
  childRowLabel: { color: colors.textMuted, fontSize: 13 },
  childRowValue: { color: colors.text, fontSize: 13, fontWeight: '600' },
});
