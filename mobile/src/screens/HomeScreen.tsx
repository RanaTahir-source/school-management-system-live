import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '@/lib/auth';
import { useMyStudent } from '@/lib/useMyStudent';
import { useMyChildren } from '@/lib/useMyChildren';
import { colors } from '@/lib/theme';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const STUDENT_MENU = [
  { key: 'Fee', title: 'Fee Status', subtitle: 'Invoices, payments & receipts', icon: '💳' },
  { key: 'Attendance', title: 'Attendance', subtitle: 'Daily record & percentage', icon: '📋' },
  { key: 'Result', title: 'Results', subtitle: 'Exams & report cards', icon: '🎓' },
] as const;

export default function HomeScreen({ navigation }: { navigation: Nav }) {
  const { user, hasRole, logout } = useAuth();
  const { student } = useMyStudent();
  const isStudent = hasRole('STUDENT');
  const isParent = hasRole('PARENT');
  const children = useMyChildren();

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <Image source={require('../../assets/icon.png')} style={styles.headerLogo} resizeMode="contain" />
        <Text style={styles.greeting}>Assalam-o-Alaikum,</Text>
        <Text style={styles.name}>{isStudent && student ? student.fullName : user?.fullName}</Text>
        {isStudent && student?.section && (
          <Text style={styles.meta}>
            {student.section.class.name} - {student.section.name} · Adm# {student.admissionNo}
          </Text>
        )}
        {!isStudent && <Text style={styles.meta}>{user?.roles.join(', ')}</Text>}
      </View>

      {isStudent ? (
        <View style={styles.menu}>
          {STUDENT_MENU.map((item) => (
            <TouchableOpacity key={item.key} style={styles.card} onPress={() => navigation.navigate(item.key as any)}>
              <Text style={styles.cardIcon}>{item.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : isParent ? (
        <View style={styles.menu}>
          {children.loading ? (
            <ActivityIndicator color={colors.green} style={{ marginTop: 20 }} />
          ) : children.error ? (
            <Text style={styles.errorText}>{children.error}</Text>
          ) : children.children.length === 0 ? (
            <Text style={styles.emptyText}>No children are linked to your account yet. Please contact the school office.</Text>
          ) : children.children.length === 1 ? (
            // Single child: skip straight to their menu, same as a student sees.
            STUDENT_MENU.map((item) => {
              const child = children.children[0];
              return (
                <TouchableOpacity
                  key={item.key}
                  style={styles.card}
                  onPress={() =>
                    navigation.navigate(
                      (item.key === 'Fee' ? 'ParentFee' : item.key === 'Attendance' ? 'ParentAttendance' : 'ParentResult') as any,
                      { studentId: child.studentId, studentName: child.fullName, studentAdmissionNo: child.admissionNo },
                    )
                  }
                >
                  <Text style={styles.cardIcon}>{item.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              );
            })
          ) : (
            // 2+ children: family ledger up top, then one card per child.
            <>
              <TouchableOpacity style={[styles.card, styles.familyCard]} onPress={() => navigation.navigate('FamilyLedger')}>
                <Text style={styles.cardIcon}>👨‍👩‍👧‍👦</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: '#fff' }]}>Family Ledger</Text>
                  <Text style={[styles.cardSubtitle, { color: '#DCEEE3' }]}>Combined fee total for all children</Text>
                </View>
                <Text style={[styles.chevron, { color: '#fff' }]}>›</Text>
              </TouchableOpacity>

              {children.children.map((child) => (
                <TouchableOpacity
                  key={child.studentId}
                  style={styles.card}
                  onPress={() =>
                    navigation.navigate('ParentChild', {
                      studentId: child.studentId,
                      studentName: child.fullName,
                      admissionNo: child.admissionNo,
                      className: child.className,
                    })
                  }
                >
                  <Text style={styles.cardIcon}>🎓</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{child.fullName}</Text>
                    <Text style={styles.cardSubtitle}>{child.className ?? `Adm# ${child.admissionNo}`}</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              ))}
            </>
          )}
        </View>
      ) : (
        <View style={styles.staffNotice}>
          <Text style={styles.staffNoticeTitle}>Staff features coming soon</Text>
          <Text style={styles.staffNoticeBody}>
            The mobile app currently supports student and parent self-service (fee status, attendance, result
            cards). For marking attendance, entering marks, and admin tools, please continue using the web
            portal for now.
          </Text>
        </View>
      )}

      <TouchableOpacity style={styles.logout} onPress={logout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { backgroundColor: colors.green, padding: 24, paddingTop: 56, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerLogo: { width: 40, height: 48, marginBottom: 10 },
  greeting: { color: '#DCEEE3', fontSize: 14 },
  name: { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 2 },
  meta: { color: colors.gold, fontSize: 13, marginTop: 6, fontWeight: '600' },
  menu: { padding: 20, gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  familyCard: { backgroundColor: colors.greenDark, borderColor: colors.greenDark },
  cardIcon: { fontSize: 26 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  cardSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  chevron: { fontSize: 22, color: colors.textMuted },
  errorText: { color: colors.danger, textAlign: 'center', marginTop: 20 },
  emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: 20, lineHeight: 20 },
  staffNotice: { margin: 20, padding: 18, backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  staffNoticeTitle: { fontWeight: '700', fontSize: 15, color: colors.text, marginBottom: 6 },
  staffNoticeBody: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  logout: { marginTop: 8, marginHorizontal: 20, paddingVertical: 14, alignItems: 'center' },
  logoutText: { color: colors.danger, fontWeight: '600', fontSize: 14 },
});
