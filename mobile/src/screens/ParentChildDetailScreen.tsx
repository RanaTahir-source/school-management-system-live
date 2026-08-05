import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '@/lib/theme';
import type { RootStackParamList } from '@/navigation/RootNavigator';

const MENU = [
  { key: 'ParentFee', title: 'Fee Status', subtitle: 'Invoices, payments & receipts', icon: '💳' },
  { key: 'ParentAttendance', title: 'Attendance', subtitle: 'Daily record & percentage', icon: '📋' },
  { key: 'ParentResult', title: 'Results', subtitle: 'Exams & report cards', icon: '🎓' },
] as const;

type Props = NativeStackScreenProps<RootStackParamList, 'ParentChild'>;

// One child's own menu - identical shape to the student HomeScreen menu, just
// reached via "My Children" instead of being the student's own home screen.
export default function ParentChildDetailScreen({ route, navigation }: Props) {
  const { studentId, studentName, admissionNo, className } = route.params;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <Text style={styles.name}>{studentName}</Text>
        {className && <Text style={styles.meta}>{className} · Adm# {admissionNo}</Text>}
      </View>

      <View style={styles.menu}>
        {MENU.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={styles.card}
            onPress={() =>
              navigation.navigate(item.key as any, { studentId, studentName, studentAdmissionNo: admissionNo })
            }
          >
            <Text style={styles.cardIcon}>{item.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { padding: 20, paddingBottom: 8 },
  name: { fontSize: 20, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  menu: { paddingHorizontal: 16, marginTop: 12, gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  cardIcon: { fontSize: 26 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  cardSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  chevron: { fontSize: 22, color: colors.textMuted },
});
