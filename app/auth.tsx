import WLLogo from '@/components/WLLogo';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Button,
  KeyboardAvoidingView, Platform,
  Text, TextInput,
  TouchableOpacity,
  useColorScheme,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loginEmployee, registerEmployee, resetPasswordToTz } from '../src/lib/storage';

export default function EmployeeAuthScreen() {
  const router = useRouter();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const text = { color: isDark ? '#fff' : '#000' } as const;
  const border = { borderColor: isDark ? '#555' : '#ccc' } as const;
  const bg = { backgroundColor: isDark ? '#000' : '#fff' } as const;

  const [isRegister, setIsRegister] = useState(false);
  const [empNo, setEmpNo] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [tz, setTz] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [employerNo, setEmployerNo] = useState('');
  const [busy, setBusy] = useState(false);

  function validateIsraeliId(id: string) { return /^[0-9]{5,9}$/.test(id); }

  async function onLogin() {
    try {
      setBusy(true);
      if (!empNo.trim() || !password) { Alert.alert('שגיאה', 'אנא הזן מספר עובד וסיסמה.'); return; }
      const w = await loginEmployee(empNo.trim(), password);
      router.replace({ pathname: '/clock', params: { empNo: String(w.empNo), name: w.fullName } });
    } catch (e: any) { Alert.alert('שגיאה', e?.message ?? 'כשל בהתחברות'); }
    finally { setBusy(false); }
  }

  async function onRegister() {
    try {
      setBusy(true);
      if (!fullName.trim()) { Alert.alert('שגיאה', 'אנא הזן שם מלא.'); return; }
      if (!validateIsraeliId(tz)) { Alert.alert('שגיאה', 'תעודת זהות לא תקינה.'); return; }
      if (!regPassword || regPassword.length < 4) { Alert.alert('שגיאה', 'סיסמה קצרה מדי (לפחות 4 תווים).'); return; }
      if (!employerNo.trim()) { Alert.alert('שגיאה', 'אנא הזן מספר מעסיק.'); return; }

      const w = await registerEmployee(fullName.trim(), tz, regPassword, employerNo.trim());
      Alert.alert('נרשמת בהצלחה', `מספר העובד שלך: ${w.empNo}`);
      router.replace({ pathname: '/clock', params: { empNo: String(w.empNo), name: w.fullName } });
    } catch (e: any) { Alert.alert('שגיאה', e?.message ?? 'כשל ברישום'); }
    finally { setBusy(false); }
  }

  async function onForgotPassword() {
    try {
      if (!empNo.trim()) { Alert.alert('שחזור סיסמה', 'הזן מספר עובד ואז לחץ "שכחתי סיסמה".'); return; }
      await resetPasswordToTz(empNo.trim());
      Alert.alert('בוצע', 'הסיסמה אופסה לתעודת הזהות של העובד.');
    } catch (e: any) { Alert.alert('שגיאה', e?.message ?? 'כשל באיפוס סיסמה'); }
  }

  return (
    <SafeAreaView style={[{ flex: 1 }, bg]}>
      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={{ flex: 1 }}>
        {/* פעולה עליונה */}
        <View style={{ alignItems: 'flex-end', paddingHorizontal: 20, marginTop: 8 }}>
          <TouchableOpacity onPress={() => setIsRegister(v => !v)} activeOpacity={0.8}>
            <Text style={[{ textDecorationLine: 'underline' }, text]}>{isRegister ? 'חזרה לכניסה' : 'רישום ראשוני'}</Text>
          </TouchableOpacity>
        </View>

        {/* לוגו באמצע */}
        <View style={{ alignItems: 'center', marginTop: 12 }}>
          <WLLogo /> 
        </View>

        {/* תוכן ממורכז אנכית */}
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 20 }}>
          {!isRegister ? (
            <View style={{ gap: 14 }}>
              <Text style={[{ fontWeight: '700', fontSize: 18, textAlign: 'center', marginBottom: 4 }, text]}>כניסה לעובד</Text>
              <View>
                <Text style={[{ fontWeight: '600', marginBottom: 6 }, text]}>מספר עובד</Text>
                <TextInput value={empNo} onChangeText={setEmpNo} keyboardType="number-pad"
                  placeholder="הקלד מספר עובד" placeholderTextColor={isDark ? '#aaa' : '#888'}
                  style={[{ borderWidth: 1, borderRadius: 10, padding: 12, color: text.color }, border]} />
              </View>
              <View>
                <Text style={[{ fontWeight: '600', marginBottom: 6 }, text]}>סיסמה</Text>
                <TextInput value={password} onChangeText={setPassword} secureTextEntry
                  placeholder="הקלד סיסמה" placeholderTextColor={isDark ? '#aaa' : '#888'}
                  style={[{ borderWidth: 1, borderRadius: 10, padding: 12, color: text.color }, border]} />
              </View>
              <Button title={busy ? 'מתחבר...' : 'כניסה'} onPress={onLogin} disabled={busy} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                <TouchableOpacity onPress={onForgotPassword}><Text style={[{ textDecorationLine: 'underline' }, text]}>שכחתי סיסמה</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => router.push('/employer-auth')}><Text style={[{ textDecorationLine: 'underline', fontWeight: '600' }, text]}>כניסת מעסיק</Text></TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={{ gap: 14 }}>
              <Text style={[{ fontWeight: '700', fontSize: 18, textAlign: 'center', marginBottom: 4 }, text]}>רישום ראשוני לעובד</Text>
              <View><Text style={[{ fontWeight: '600', marginBottom: 6 }, text]}>שם מלא</Text>
                <TextInput value={fullName} onChangeText={setFullName} placeholder="הקלד שם מלא"
                  placeholderTextColor={isDark ? '#aaa' : '#888'}
                  style={[{ borderWidth: 1, borderRadius: 10, padding: 12, color: text.color }, border]} /></View>
              <View><Text style={[{ fontWeight: '600', marginBottom: 6 }, text]}>תעודת זהות</Text>
                <TextInput value={tz} onChangeText={setTz} keyboardType="number-pad" maxLength={9}
                  placeholder="הקלד ת.ז." placeholderTextColor={isDark ? '#aaa' : '#888'}
                  style={[{ borderWidth: 1, borderRadius: 10, padding: 12, color: text.color }, border]} /></View>
              <View><Text style={[{ fontWeight: '600', marginBottom: 6 }, text]}>סיסמה</Text>
                <TextInput value={regPassword} onChangeText={setRegPassword} secureTextEntry
                  placeholder="בחר סיסמה" placeholderTextColor={isDark ? '#aaa' : '#888'}
                  style={[{ borderWidth: 1, borderRadius: 10, padding: 12, color: text.color }, border]} /></View>
              <View><Text style={[{ fontWeight: '600', marginBottom: 6 }, text]}>מספר מעסיק</Text>
                <TextInput value={employerNo} onChangeText={setEmployerNo} keyboardType="number-pad"
                  placeholder="הקלד מספר מעסיק" placeholderTextColor={isDark ? '#aaa' : '#888'}
                  style={[{ borderWidth: 1, borderRadius: 10, padding: 12, color: text.color }, border]} /></View>
              <Button title={busy ? 'נרשם...' : 'רישום'} onPress={onRegister} disabled={busy} />
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}