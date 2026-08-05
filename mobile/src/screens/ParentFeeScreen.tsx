import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api, ApiError } from '@/lib/api';
import { colors } from '@/lib/theme';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type FeeItem = { feeHead: { name: string }; amount: number };
type Payment = { id: string; receiptNo: string; amount: number; paidDate: string };
type Invoice = {
  id: string;
  period: string;
  status: 'PAID' | 'PARTIAL' | 'UNPAID' | string;
  totalAmount: number;
  items: FeeItem[];
  payments: Payment[];
};

function balanceOf(inv: Invoice) {
  const paid = inv.payments.reduce((sum, p) => sum + p.amount, 0);
  return inv.totalAmount - paid;
}

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  PAID: { bg: colors.successBg, text: colors.success },
  PARTIAL: { bg: colors.warningBg, text: colors.warning },
  UNPAID: { bg: colors.dangerBg, text: colors.danger },
};

type Props = NativeStackScreenProps<RootStackParamList, 'ParentFee'>;

// Same UI as the student FeeScreen, but hits the parent-portal endpoint
// (which checks the ParentStudent link) for a chosen child's studentId.
export default function ParentFeeScreen({ route }: Props) {
  const { studentId } = route.params;
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sharing, setSharing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api.get<Invoice[]>(`/parent-portal/children/${studentId}/fees`);
      setInvoices(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.body?.message ?? err.message : 'Could not load fee records');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [studentId]);

  useEffect(() => {
    load();
  }, [load]);

  async function shareReceipt(payment: Payment) {
    setSharing(payment.id);
    try {
      await api.openOrSharePdf(`/finance/fee-payments/${payment.id}/receipt.pdf`, `receipt-${payment.receiptNo}.pdf`);
    } catch (err) {
      setError(err instanceof ApiError ? err.body?.message ?? err.message : 'Could not open receipt');
    } finally {
      setSharing(null);
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
      data={invoices}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      ListEmptyComponent={!error ? <Text style={styles.empty}>No fee invoices found yet.</Text> : null}
      ListHeaderComponent={error ? <Text style={styles.errorText}>{error}</Text> : null}
      renderItem={({ item }) => {
        const bal = balanceOf(item);
        const statusStyle = STATUS_STYLE[item.status] ?? STATUS_STYLE.UNPAID;
        return (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.period}>{item.period}</Text>
              <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
                <Text style={[styles.badgeText, { color: statusStyle.text }]}>{item.status}</Text>
              </View>
            </View>

            {item.items.map((it, idx) => (
              <View key={idx} style={styles.row}>
                <Text style={styles.rowLabel}>{it.feeHead.name}</Text>
                <Text style={styles.rowValue}>Rs. {it.amount.toLocaleString()}</Text>
              </View>
            ))}

            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>Rs. {item.totalAmount.toLocaleString()}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Balance</Text>
              <Text style={[styles.rowValue, { color: bal > 0 ? colors.danger : colors.success, fontWeight: '700' }]}>
                Rs. {bal.toLocaleString()}
              </Text>
            </View>

            {item.payments.length > 0 && (
              <View style={styles.payments}>
                {item.payments.map((p) => (
                  <TouchableOpacity key={p.id} style={styles.receiptBtn} onPress={() => shareReceipt(p)} disabled={sharing === p.id}>
                    {sharing === p.id ? (
                      <ActivityIndicator size="small" color={colors.green} />
                    ) : (
                      <Text style={styles.receiptBtnText}>
                        Receipt #{p.receiptNo} · Rs. {p.amount.toLocaleString()} ↓
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg, padding: 20 },
  errorText: { color: colors.danger, textAlign: 'center', marginBottom: 12 },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 40 },
  card: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 14 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  period: { fontSize: 16, fontWeight: '700', color: colors.text },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  rowLabel: { color: colors.textMuted, fontSize: 13 },
  rowValue: { color: colors.text, fontSize: 13 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 8 },
  totalLabel: { color: colors.text, fontSize: 13, fontWeight: '700' },
  totalValue: { color: colors.text, fontSize: 13, fontWeight: '700' },
  payments: { marginTop: 10, gap: 6 },
  receiptBtn: { backgroundColor: colors.successBg, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10 },
  receiptBtnText: { color: colors.success, fontSize: 12, fontWeight: '600' },
});
