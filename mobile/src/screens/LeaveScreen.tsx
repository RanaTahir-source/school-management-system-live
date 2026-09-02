import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { colors } from '@/lib/theme';

type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

type LeaveRequest = {
  id: string;
  fromDate: string;
  toDate: string;
  reason: string;
  status: LeaveStatus;
  reviewRemarks: string | null;
  student?: { user: { fullName: string } } | null;
  staffUser?: { fullName: string } | null;
};

const STATUS_STYLE: Record<LeaveStatus, { bg: string; fg: string }> = {
  APPROVED: { bg: colors.successBg, fg: colors.success },
  PENDING: { bg: colors.warningBg, fg: colors.warning },
  REJECTED: { bg: colors.dangerBg, fg: colors.danger },
  CANCELLED: { bg: '#f1f5f9', fg: colors.textMuted },
};

export default function LeaveScreen() {
  const { hasRole } = useAuth();
  const canReview = hasRole('DIRECTOR', 'ADMIN', 'PRINCIPAL');

  const [mine, setMine] = useState<LeaveRequest[] | null>(null);
  const [pending, setPending] = useState<LeaveRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const requests: Promise<any>[] = [api.get<LeaveRequest[]>('/leave-requests/mine')];
      if (canReview) requests.push(api.get<LeaveRequest[]>('/leave-requests', { status: 'PENDING' }));
      const results = await Promise.all(requests);
      setMine(results[0]);
      if (canReview) setPending(results[1]);
    } catch (err) {
      setError(err instanceof ApiError ? err.body?.message ?? err.message : 'Could not load leave requests.');
    } finally {
      setRefreshing(false);
    }
  }, [canReview]);

  useEffect(() => {
    load();
  }, [load]);

  async function submitApply() {
    setFormError(null);
    if (!fromDate.trim() || !toDate.trim() || !reason.trim()) {
      setFormError('Please fill in from date, to date, and a reason.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/leave-requests', { fromDate: fromDate.trim(), toDate: toDate.trim(), reason: reason.trim() });
      setFromDate('');
      setToDate('');
      setReason('');
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.body?.message ?? err.message : 'Could not submit your leave request.');
    } finally {
      setSubmitting(false);
    }
  }

  async function review(id: string, status: 'APPROVED' | 'REJECTED') {
    try {
      await api.patch(`/leave-requests/${id}/review`, { status });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.body?.message ?? err.message : 'Could not update this request.');
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Apply for leave</Text>
        <TextInput style={styles.input} value={fromDate} onChangeText={setFromDate} placeholder="From date (YYYY-MM-DD)" placeholderTextColor="#9AA8A1" />
        <TextInput style={styles.input} value={toDate} onChangeText={setToDate} placeholder="To date (YYYY-MM-DD)" placeholderTextColor="#9AA8A1" />
        <TextInput
          style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
          value={reason}
          onChangeText={setReason}
          placeholder="Reason"
          placeholderTextColor="#9AA8A1"
          multiline
        />
        {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
        <TouchableOpacity style={styles.button} onPress={submitApply} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Submit</Text>}
        </TouchableOpacity>
      </View>

      {canReview && (
        <View style={{ marginBottom: 8 }}>
          <Text style={styles.sectionTitle}>Pending approvals</Text>
          {pending === null ? (
            <ActivityIndicator color={colors.green} style={{ marginTop: 10 }} />
          ) : pending.length === 0 ? (
            <Text style={styles.empty}>Nothing waiting on you right now.</Text>
          ) : (
            pending.map((lr) => (
              <View key={lr.id} style={styles.card}>
                <Text style={styles.name}>{lr.student?.user.fullName ?? lr.staffUser?.fullName ?? 'Unknown'}</Text>
                <Text style={styles.meta}>{lr.fromDate.slice(0, 10)} to {lr.toDate.slice(0, 10)}</Text>
                <Text style={styles.meta}>{lr.reason}</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <TouchableOpacity style={[styles.smallButton, { backgroundColor: colors.green }]} onPress={() => review(lr.id, 'APPROVED')}>
                    <Text style={styles.smallButtonText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.smallButton, { backgroundColor: colors.danger }]} onPress={() => review(lr.id, 'REJECTED')}>
                    <Text style={styles.smallButtonText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      )}

      <Text style={styles.sectionTitle}>My requests</Text>
      {mine === null ? (
        <ActivityIndicator color={colors.green} style={{ marginTop: 10 }} />
      ) : mine.length === 0 ? (
        <Text style={styles.empty}>No leave requests yet.</Text>
      ) : (
        mine.map((lr) => {
          const s = STATUS_STYLE[lr.status];
          return (
            <View key={lr.id} style={styles.card}>
              <View style={[styles.badge, { backgroundColor: s.bg, alignSelf: 'flex-start' }]}>
                <Text style={[styles.badgeText, { color: s.fg }]}>{lr.status}</Text>
              </View>
              <Text style={styles.meta}>{lr.fromDate.slice(0, 10)} to {lr.toDate.slice(0, 10)}</Text>
              <Text style={styles.meta}>{lr.reason}</Text>
              {lr.reviewRemarks ? <Text style={styles.remarks}>Remarks: {lr.reviewRemarks}</Text> : null}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  errorText: { color: colors.danger, marginBottom: 10 },
  empty: { textAlign: 'center', color: colors.textMuted, marginVertical: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10, marginTop: 4 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    marginBottom: 10,
  },
  button: { backgroundColor: colors.green, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  smallButton: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  smallButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  name: { fontSize: 15, fontWeight: '600', color: colors.text, marginTop: 6 },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  remarks: { fontSize: 12, color: colors.textMuted, marginTop: 6, fontStyle: 'italic' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginBottom: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
});
