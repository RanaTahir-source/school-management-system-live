import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { colors } from '@/lib/theme';

type SectionRecord = {
  id: string;
  name: string;
  class?: { id: string; name: string };
  classTeacher?: { id: string; fullName: string } | null;
};

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE';

type MarkSheetRow = {
  studentId: string;
  admissionNo: string;
  fullName: string;
  status: AttendanceStatus | null;
  remarks: string | null;
};

const STATUS_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: 'PRESENT', label: 'P' },
  { value: 'ABSENT', label: 'A' },
  { value: 'LATE', label: 'L' },
  { value: 'LEAVE', label: 'Lv' },
];

const STATUS_COLORS: Record<AttendanceStatus, { bg: string; fg: string }> = {
  PRESENT: { bg: colors.successBg, fg: colors.success },
  ABSENT: { bg: colors.dangerBg, fg: colors.danger },
  LATE: { bg: colors.warningBg, fg: colors.warning },
  LEAVE: { bg: '#E7EEF6', fg: '#2A5D8A' },
};

function todayIso() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export default function MarkAttendanceScreen() {
  const { user, hasRole } = useAuth();
  const canOverride = hasRole('DIRECTOR', 'ADMIN', 'PRINCIPAL');

  const [sections, setSections] = useState<SectionRecord[] | null>(null);
  const [sectionsError, setSectionsError] = useState<string | null>(null);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [date, setDate] = useState(todayIso());

  const [rows, setRows] = useState<MarkSheetRow[] | null>(null);
  const [rowsError, setRowsError] = useState<string | null>(null);
  const [loadingRows, setLoadingRows] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get<SectionRecord[]>('/sections');
        setSections(data);
      } catch (err) {
        setSectionsError(err instanceof ApiError ? err.body?.message ?? err.message : 'Could not load sections.');
      }
    })();
  }, []);

  const mySections = useMemo(() => {
    if (!sections) return [];
    if (canOverride) return sections;
    return sections.filter((s) => s.classTeacher?.id === user?.userId);
  }, [sections, canOverride, user?.userId]);

  useEffect(() => {
    if (!sectionId && mySections.length > 0) setSectionId(mySections[0].id);
  }, [mySections, sectionId]);

  const loadSheet = useCallback(async () => {
    if (!sectionId || !date.trim()) return;
    setLoadingRows(true);
    setRowsError(null);
    setSaveSuccess(false);
    try {
      const data = await api.get<MarkSheetRow[]>('/attendance', { sectionId, date: date.trim() });
      setRows(data);
    } catch (err) {
      setRowsError(err instanceof ApiError ? err.body?.message ?? err.message : 'Could not load the mark sheet.');
    } finally {
      setLoadingRows(false);
    }
  }, [sectionId, date]);

  useEffect(() => {
    loadSheet();
  }, [loadSheet]);

  function setStatus(studentId: string, status: AttendanceStatus) {
    setSaveSuccess(false);
    setRows((prev) => (prev ? prev.map((r) => (r.studentId === studentId ? { ...r, status } : r)) : prev));
  }

  function markAllPresent() {
    setSaveSuccess(false);
    setRows((prev) => (prev ? prev.map((r) => ({ ...r, status: 'PRESENT' as AttendanceStatus })) : prev));
  }

  async function save() {
    if (!rows || !sectionId) return;
    const entries = rows
      .filter((r) => r.status !== null)
      .map((r) => ({ studentId: r.studentId, status: r.status as AttendanceStatus, remarks: r.remarks ?? undefined }));
    if (entries.length === 0) {
      setSaveError('Mark at least one student before saving.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await api.post('/attendance/mark', { sectionId, date: date.trim(), entries });
      setSaveSuccess(true);
      await loadSheet();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.body?.message ?? err.message : 'Could not save attendance.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      {sectionsError ? <Text style={styles.errorText}>{sectionsError}</Text> : null}

      {sections === null ? (
        <ActivityIndicator color={colors.green} style={{ marginTop: 30 }} />
      ) : mySections.length === 0 ? (
        <Text style={styles.empty}>You are not the class teacher of any section.</Text>
      ) : (
        <>
          <View style={styles.filterCard}>
            <Text style={styles.label}>Section</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
              {mySections.map((s) => {
                const active = s.id === sectionId;
                return (
                  <TouchableOpacity key={s.id} onPress={() => setSectionId(s.id)} style={[styles.chip, active && styles.chipActive]}>
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {s.class?.name ?? ''} {s.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.label}>Date</Text>
            <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor="#9AA8A1" autoCapitalize="none" />
          </View>

          {rowsError ? <Text style={styles.errorText}>{rowsError}</Text> : null}
          {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}
          {saveSuccess ? <Text style={styles.successText}>Attendance saved.</Text> : null}

          {loadingRows || rows === null ? (
            <ActivityIndicator color={colors.green} style={{ marginTop: 30 }} />
          ) : rows.length === 0 ? (
            <Text style={styles.empty}>No students found in this section.</Text>
          ) : (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 30 }}>
              <TouchableOpacity style={styles.outlineButton} onPress={markAllPresent}>
                <Text style={styles.outlineButtonText}>Mark all Present</Text>
              </TouchableOpacity>

              {rows.map((r) => (
                <View key={r.studentId} style={styles.studentCard}>
                  <Text style={styles.studentName}>{r.fullName}</Text>
                  <Text style={styles.admissionNo}>{r.admissionNo}</Text>
                  <View style={styles.statusRow}>
                    {STATUS_OPTIONS.map((opt) => {
                      const active = r.status === opt.value;
                      const tone = STATUS_COLORS[opt.value];
                      return (
                        <TouchableOpacity
                          key={opt.value}
                          onPress={() => setStatus(r.studentId, opt.value)}
                          style={[styles.statusButton, { borderColor: active ? tone.fg : colors.border }, active && { backgroundColor: tone.bg }]}
                        >
                          <Text style={[styles.statusButtonText, { color: active ? tone.fg : colors.textMuted }]}>{opt.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}

              <TouchableOpacity style={styles.saveButton} onPress={save} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save Attendance</Text>}
              </TouchableOpacity>
            </ScrollView>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  errorText: { color: colors.danger, marginBottom: 10 },
  successText: { color: colors.success, marginBottom: 10, fontWeight: '600' },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: 40 },
  label: { fontSize: 12, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase' },
  filterCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
    marginRight: 8,
  },
  chipActive: { backgroundColor: colors.green, borderColor: colors.green },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  chipTextActive: { color: '#fff' },
  outlineButton: {
    borderWidth: 1,
    borderColor: colors.green,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    marginBottom: 12,
  },
  outlineButtonText: { color: colors.green, fontWeight: '600', fontSize: 14 },
  studentCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 10,
  },
  studentName: { fontSize: 15, fontWeight: '600', color: colors.text },
  admissionNo: { fontSize: 12, color: colors.textMuted, marginTop: 2, marginBottom: 10 },
  statusRow: { flexDirection: 'row', gap: 8 },
  statusButton: { flex: 1, borderWidth: 1.5, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  statusButtonText: { fontSize: 14, fontWeight: '700' },
  saveButton: { backgroundColor: colors.green, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
