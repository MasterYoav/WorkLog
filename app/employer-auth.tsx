// app/employer-auth.tsx
import WLLogo from '@/components/WLLogo';
import * as Clipboard from 'expo-clipboard';
import * as MailComposer from 'expo-mail-composer';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Button, KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cloudLoginEmployer, cloudRegisterEmployer } from '../src/data/repo';

export default function EmployerAuthScreen() {
  const router = useRouter();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const text = { color: isDark ? '#fff' : '#000' } as const;
  const border = { borderColor: isDark ? '#555' : '#ccc' } as const;
  const bg = { backgroundColor: isDark ? '#000' : '#fff' } as const;

  const [isRegister, setIsRegister] = useState(false);
  const [employerNo, setEmployerNo] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  async function onEmployerLogin() {
    try {
      setBusy(true);
      if (!employerNo.trim() || !password) { Alert.alert('שגיאה', 'אנא הזן מספר מעסיק וסיסמה.'); return; }
      const emp = await cloudLoginEmployer(Number(employerNo.trim()), password);
      router.replace({ pathname: '/employer-home', params: { employerNo: String(emp.employer_no), company: emp.name } });
    } catch (e: any) { Alert.alert('שגיאה', e?.message ?? 'כשל בהתחברות'); }
    finally { setBusy(false); }
  }

  async function onEmployerRegister() {
    try {
      setBusy(true);
      if (!companyName.trim()) { Alert.alert('שגיאה', 'אנא הזן שם חברה.'); return; }
      if (!email.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { Alert.alert('שגיאה', 'אנא הזן אימייל תקין.'); return; }
      if (!regPassword || regPassword.length < 4) { Alert.alert('שגיאה', 'סיסמה קצרה מדי (לפחות 4 תווים).'); return; }
      const emp = await cloudRegisterEmployer(companyName.trim(), email.trim(), regPassword);
      Alert.alert(
        'נרשמת בהצלחה',
        `מספר המעסיק שלך: ${emp.employer_no}`,
        [
          { text: 'העתק', onPress: () => Clipboard.setStringAsync(String(emp.employer_no)) },
          { text: 'OK' },
        ]
      );
      router.replace({ pathname: '/employer-home', params: { employerNo: String(emp.employer_no), company: emp.name } });
    } catch (e: any) { Alert.alert('שגיאה', e?.message ?? 'כשל ברישום'); }
    finally { setBusy(false); }
  }

  async function onForgotPassword() {
    try {
      if (!email.trim()) { Alert.alert('שגיאה', 'אנא הזן אימייל לשחזור.'); return; }
      const tmp = Math.random().toString(36).slice(2, 8);
      await MailComposer.composeAsync({
        recipients: [email.trim()],
        subject: 'WorkLog – Password Reset',
        body: `סיסמה זמנית: ${tmp}\n\nהתחבר/י ועדכן/י סיסמה בהגדרות.`,
      });
      Alert.alert('שחזור סיסמה', `סיסמה זמנית: ${tmp}`, [
        { text: 'העתק', onPress: () => Clipboard.setStringAsync(tmp) },
        { text: 'OK' },
      ]);
    } catch (e: any) { Alert.alert('שגיאה', e?.message ?? 'כשל בשחזור סיסמה'); }
  }

  return (
    <SafeAreaView style={[{ flex: 1 }, bg]}>
      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={{ flex: 1 }}>
        <View style={{ alignItems: 'flex-end', paddingHorizontal: 20, marginTop: 8 }}>
          <TouchableOpacity onPress={() => setIsRegister(v => !v)}><Text style={[{ textDecorationLine: 'underline' }, text]}>{isRegister ? 'חזרה לכניסה' : 'רישום ראשוני'}</Text></TouchableOpacity>
        </View>

        <View style={{ alignItems: 'center', marginTop: 12 }}>
          <WLLogo />
        </View>

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
              <View>
                <Text style={[{ fontWeight: '600', marginBottom: 6 }, text]}>אימייל (לשחזור סיסמה)</Text>
                <TextInput value={email} onChangeText={setEmail} keyboardType="email-address"
                  placeholder="name@company.com" placeholderTextColor={isDark ? '#aaa' : '#888'}
                  autoCapitalize="none"
                  style={[{ borderWidth: 1, borderRadius: 10, padding: 12, color: text.color }, border]} />
              </View>
              <Button title={busy ? 'מתחבר...' : 'כניסה'} onPress={onEmployerLogin} disabled={busy} />
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