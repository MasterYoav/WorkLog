import * as MailComposer from 'expo-mail-composer';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Button,
  Image, KeyboardAvoidingView, Platform,
  Text, TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loginEmployer, registerEmployer, resetEmployerPassword } from '../src/lib/storage';

export default function EmployerAuthScreen() {
  const router = useRouter();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const text = { color: isDark ? '#fff' : '#000' } as const;
  const border = { borderColor: isDark ? '#555' : '#ccc' } as const;
  const bg = { backgroundColor: isDark ? '#000' : '#fff' } as const;

  const [isRegister, setIsRegister] = useState(false);

  // כניסה
  const [employerNo, setEmployerNo] = useState('');
  const [password, setPassword] = useState('');

  // רישום
  const [companyName, setCompanyName] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [email, setEmail] = useState('');

  const [busy, setBusy] = useState(false);

  async function onEmployerLogin() {
    try {
      setBusy(true);
      if (!employerNo.trim() || !password) { Alert.alert('שגיאה', 'אנא הזן מספר מעסיק וסיסמה.'); return; }
      const emp = await loginEmployer(employerNo.trim(), password);
      router.replace({ pathname: '/employer-home', params: { employerNo: String(emp.employerNo), company: emp.name } });
    } catch (e: any) { Alert.alert('שגיאה', e?.message ?? 'כשל בהתחברות'); }
    finally { setBusy(false); }
  }

  async function onEmployerRegister() {
    try {
      setBusy(true);
      if (!companyName.trim()) { Alert.alert('שגיאה', 'אנא הזן שם חברה.'); return; }
      if (!email.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { Alert.alert('שגיאה', 'אנא הזן אימייל תקין.'); return; }
      if (!regPassword || regPassword.length < 4) { Alert.alert('שגיאה', 'סיסמה קצרה מדי (לפחות 4 תווים).'); return; }
      const emp = await registerEmployer(companyName.trim(), regPassword, email.trim());
      Alert.alert('נרשמת בהצלחה', `מספר המעסיק שלך: ${emp.employerNo}`);
      router.replace({ pathname: '/employer-home', params: { employerNo: String(emp.employerNo), company: emp.name } });
    } catch (e: any) { Alert.alert('שגיאה', e?.message ?? 'כשל ברישום'); }
    finally { setBusy(false); }
  }

  async function onForgotPassword() {
    try {
      if (!email.trim()) { Alert.alert('שגיאה', 'אנא הזן אימייל לשחזור.'); return; }
      const { newPassword, employer } = await resetEmployerPassword(email.trim());
      // שולחים מייל (פותח חלון של המייל במכשיר לשליחה)
      const can = await MailComposer.isAvailableAsync();
      if (can) {
        await MailComposer.composeAsync({
          recipients: [email.trim()],
          subject: 'WorkLog – Password Reset',
          body: `Hi ${employer.name},\n\nYour temporary password: ${newPassword}\nPlease log in and change it in Settings.\n\n— WorkLog`,
        });
        Alert.alert('שחזור סיסמה', 'נפתח מייל עם סיסמה חדשה. שלח את ההודעה כדי להשלים.');
      } else {
        Alert.alert('שחזור סיסמה', `סיסמה זמנית: ${newPassword}\n(שליחת מייל לא זמינה במכשיר זה)`);
      }
    } catch (e: any) {
      Alert.alert('שגיאה', e?.message ?? 'כשל בשחזור סיסמה');
    }
  }

  return (
    <SafeAreaView style={[{ flex: 1 }, bg]}>
      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={{ flex: 1 }}>
        {/* פעולה עליונה */}
        <View style={{ alignItems: 'flex-end', paddingHorizontal: 20, marginTop: 8 }}>
          <TouchableOpacity onPress={() => setIsRegister(v => !v)}><Text style={[{ textDecorationLine: 'underline' }, text]}>{isRegister ? 'חזרה לכניסה' : 'רישום ראשוני'}</Text></TouchableOpacity>
        </View>

        {/* לוגו באמצע */}
        <View style={{ alignItems: 'center', marginTop: 12 }}>
          <Image source={require('../assets/logo.png')} style={{ width: 220, height: 72, resizeMode: 'contain' }} />
        </View>

        {/* תוכן ממורכז */}
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 20 }}>
          {!isRegister ? (
            <View style={{ gap: 14 }}>
              <Text style={[{ fontWeight: '700', fontSize: 18, textAlign: 'center', marginBottom: 4 }, text]}>כניסת מעסיק</Text>

              <View>
                <Text style={[{ fontWeight: '600', marginBottom: 6 }, text]}>מספר מעסיק</Text>
                <TextInput value={employerNo} onChangeText={setEmployerNo} keyboardType="number-pad"
                  placeholder="הקלד מספר מעסיק" placeholderTextColor={isDark ? '#aaa' : '#888'}
                  style={[{ borderWidth: 1, borderRadius: 10, padding: 12, color: text.color }, border]} />
              </View>

              <View>
                <Text style={[{ fontWeight: '600', marginBottom: 6 }, text]}>סיסמה</Text>
                <TextInput value={password} onChangeText={setPassword} secureTextEntry
                  placeholder="הקלד סיסמה" placeholderTextColor={isDark ? '#aaa' : '#888'}
                  style={[{ borderWidth: 1, borderRadius: 10, padding: 12, color: text.color }, border]} />
              </View>

              {/* אימייל לשחזור */}
              <View>
                <Text style={[{ fontWeight: '600', marginBottom: 6 }, text]}>אימייל (לשחזור סיסמה)</Text>
                <TextInput value={email} onChangeText={setEmail} keyboardType="email-address"
                  placeholder="name@company.com" placeholderTextColor={isDark ? '#aaa' : '#888'}
                  autoCapitalize="none"
                  style={[{ borderWidth: 1, borderRadius: 10, padding: 12, color: text.color }, border]} />
              </View>

              <Button title={busy ? 'מתחבר...' : 'כניסה'} onPress={onEmployerLogin} disabled={busy} />

              {/* שורה תחתונה: שכחתי סיסמה (שולח מייל) · כניסת עובד */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                <TouchableOpacity onPress={onForgotPassword}><Text style={[{ textDecorationLine: 'underline' }, text]}>שכחתי סיסמה</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => router.replace('/auth')}><Text style={[{ textDecorationLine: 'underline', fontWeight: '600' }, text]}>כניסת עובד</Text></TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={{ gap: 14 }}>
              <Text style={[{ fontWeight: '700', fontSize: 18, textAlign: 'center', marginBottom: 4 }, text]}>רישום ראשוני למעסיק</Text>

              <View><Text style={[{ fontWeight: '600', marginBottom: 6 }, text]}>שם חברה</Text>
                <TextInput value={companyName} onChangeText={setCompanyName} placeholder="הקלד שם חברה"
                  placeholderTextColor={isDark ? '#aaa' : '#888'}
                  style={[{ borderWidth: 1, borderRadius: 10, padding: 12, color: text.color }, border]} /></View>

              <View><Text style={[{ fontWeight: '600', marginBottom: 6 }, text]}>אימייל</Text>
                <TextInput value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none"
                  placeholder="name@company.com" placeholderTextColor={isDark ? '#aaa' : '#888'}
                  style={[{ borderWidth: 1, borderRadius: 10, padding: 12, color: text.color }, border]} /></View>

              <View><Text style={[{ fontWeight: '600', marginBottom: 6 }, text]}>סיסמה</Text>
                <TextInput value={regPassword} onChangeText={setRegPassword} secureTextEntry
                  placeholder="בחר סיסמה" placeholderTextColor={isDark ? '#aaa' : '#888'}
                  style={[{ borderWidth: 1, borderRadius: 10, padding: 12, color: text.color }, border]} /></View>

              <Button title={busy ? 'נרשם...' : 'רישום'} onPress={onEmployerRegister} disabled={busy} />
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}