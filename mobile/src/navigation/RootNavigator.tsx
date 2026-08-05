import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '@/lib/auth';
import { colors } from '@/lib/theme';
import LoginScreen from '@/screens/LoginScreen';
import HomeScreen from '@/screens/HomeScreen';
import FeeScreen from '@/screens/FeeScreen';
import AttendanceScreen from '@/screens/AttendanceScreen';
import ResultScreen from '@/screens/ResultScreen';
import ParentChildDetailScreen from '@/screens/ParentChildDetailScreen';
import ParentFeeScreen from '@/screens/ParentFeeScreen';
import ParentAttendanceScreen from '@/screens/ParentAttendanceScreen';
import ParentResultScreen from '@/screens/ParentResultScreen';
import FamilyLedgerScreen from '@/screens/FamilyLedgerScreen';

export type RootStackParamList = {
  Home: undefined;
  Fee: undefined;
  Attendance: undefined;
  Result: undefined;
  // Parent-only screens - reached from Home when the logged-in user has the
  // PARENT role (see HomeScreen.tsx).
  ParentChild: { studentId: string; studentName: string; admissionNo: string; className: string | null };
  ParentFee: { studentId: string; studentName: string; studentAdmissionNo: string };
  ParentAttendance: { studentId: string; studentName: string; studentAdmissionNo: string };
  ParentResult: { studentId: string; studentName: string; studentAdmissionNo: string };
  FamilyLedger: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { isAuthenticated, isBooting } = useAuth();

  if (isBooting) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.green }}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.green },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'DAS Connect' }} />
      <Stack.Screen name="Fee" component={FeeScreen} options={{ title: 'Fee Status' }} />
      <Stack.Screen name="Attendance" component={AttendanceScreen} options={{ title: 'Attendance' }} />
      <Stack.Screen name="Result" component={ResultScreen} options={{ title: 'Results' }} />

      <Stack.Screen
        name="ParentChild"
        component={ParentChildDetailScreen}
        options={({ route }) => ({ title: route.params.studentName })}
      />
      <Stack.Screen
        name="ParentFee"
        component={ParentFeeScreen}
        options={({ route }) => ({ title: `Fee Status · ${route.params.studentName}` })}
      />
      <Stack.Screen
        name="ParentAttendance"
        component={ParentAttendanceScreen}
        options={({ route }) => ({ title: `Attendance · ${route.params.studentName}` })}
      />
      <Stack.Screen
        name="ParentResult"
        component={ParentResultScreen}
        options={({ route }) => ({ title: `Results · ${route.params.studentName}` })}
      />
      <Stack.Screen name="FamilyLedger" component={FamilyLedgerScreen} options={{ title: 'Family Ledger' }} />
    </Stack.Navigator>
  );
}
