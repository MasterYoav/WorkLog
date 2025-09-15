import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Button, Image, Text, TextInput, TouchableOpacity, useColorScheme, View } from 'react-native';
import { loginEmployer, registerEmployer } from '../src/lib/storage';

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

  const [busy, setBusy] = useState(false);

  function goEmployeeAuth() {
    router.replace('/auth');
  }

  async function onEmployerLogin() {
    try {
      setBusy(true);
      if (!employerNo.trim() || !password) {
        Alert.alert('שגיאה', 'אנא הזן מספר מעסיק וסיסמה.');
        return;
      }
      const emp = await loginEmployer(employerNo.trim(), password);
      router.replace({ pathname: '/employer-home', params: { employerNo: String(emp.employerNo), company: emp.name } });
    } catch (e: any) {
      Alert.alert('שגיאה', e?.message ?? 'כשל בהתחברות');
    } finally {
      setBusy(false);
    }
  }

  async function onEmployerRegister() {
    try {
      setBusy(true);
      if (!companyName.trim()) { Alert.alert('שגיאה', 'אנא הזן שם חברה.'); return; }
      if (!regPassword || regPassword.length < 4) { Alert.alert('שגיאה', 'סיסמה קצרה מדי (לפחות 4 תווים).'); return; }
      const emp = await registerEmployer(companyName.trim(), regPassword);
      Alert.alert('נרשמת בהצלחה', `מספר המעסיק שלך: ${emp.employerNo}`);
      router.replace({ pathname: '/employer-home', params: { employerNo: String(emp.employerNo), company: emp.name } });
    } catch (e: any) {
      Alert.alert('שגיאה', e?.message ?? 'כשל ברישום');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[{ flex: 1, padding: 20 }, bg]}>
      {/* בר עליון: לוגו + מעבר לעובד */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Image source={require('../assets/logo.png')} style={{ width: 120, height: 40, resizeMode: 'contain' }} />
          <Text style={[{ fontSize: 16, opacity: 0.7 }, text]}>מעסיקים</Text>
        </View>
        <TouchableOpacity onPress={goEmployeeAuth} activeOpacity={0.8}>
          <Text style={[{ textDecorationLine: 'underline', fontWeight: '600' }, text]}>כניסת עובד</Text>
        </TouchableOpacity>
      </View>

      {/* כפתור "רישום ראשוני" */}
      <View style={{ alignItems: 'flex-end', marginTop: 6 }}>
        <TouchableOpacity onPress={() => setIsRegister(v => !v)} activeOpacity={0.8}>
          <Text style={[{ textDecorationLine: 'underline' }, text]}>{isRegister ? 'חזרה לכניסה' : 'רישום ראשוני'}</Text>
        </TouchableOpacity>
      </View>

      {!isRegister ? (
        <View style={{ marginTop: 24, gap: 12 }}>
          <Text style={[{ fontWeight: '700', fontSize: 16 }, text]}>כניסת מעסיק</Text>

          <View>
            <Text style={[{ fontWeight: '600' }, text]}>מספר מעסיק</Text>
            <TextInput
              value={employerNo}
              onChangeText={setEmployerNo}
              keyboardType="number-pad"
              placeholder="הקלד מספר מעסיק"
              placeholderTextColor={isDark ? '#aaa' : '#888'}
              style={[{ borderWidth: 1, borderRadius: 8, padding: 12, color: text.color }, border]}
            />
          </View>

          <View>
            <Text style={[{ fontWeight: '600' }, text]}>סיסמה</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="הקלד סיסמה"
              secureTextEntry
              placeholderTextColor={isDark ? '#aaa' : '#888'}
              style={[{ borderWidth: 1, borderRadius: 8, padding: 12, color: text.color }, border]}
            />
          </View>

          <Button title={busy ? 'מתחבר...' : 'כניסה'} onPress={onEmployerLogin} disabled={busy} />
        </View>
      ) : (
        <View style={{ marginTop: 24, gap: 12 }}>
          <Text style={[{ fontWeight: '700', fontSize: 16 }, text]}>רישום ראשוני למעסיק</Text>

          <View>
            <Text style={[{ fontWeight: '600' }, text]}>שם חברה</Text>
            <TextInput
              value={companyName}
              onChangeText={setCompanyName}
              placeholder="הקלד שם חברה"
              placeholderTextColor={isDark ? '#aaa' : '#888'}
              style={[{ borderWidth: 1, borderRadius: 8, padding: 12, color: text.color }, border]}
            />
          </View>

          <View>
            <Text style={[{ fontWeight: '600' }, text]}>סיסמה</Text>
            <TextInput
              value={regPassword}
              onChangeText={setRegPassword}
              placeholder="בחר סיסמה"
              secureTextEntry
              placeholderTextColor={isDark ? '#aaa' : '#888'}
              style={[{ borderWidth: 1, borderRadius: 8, padding: 12, color: text.color }, border]}
            />
          </View>

          <Button title={busy ? 'נרשם...' : 'רישום'} onPress={onEmployerRegister} disabled={busy} />
        </View>
      )}
    </View>
  );
}