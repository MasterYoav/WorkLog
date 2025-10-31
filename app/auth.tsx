// app/auth.tsx
import WLLogo from '@/components/WLLogo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View, useColorScheme } from 'react-native';
import {
  cloudLoginEmployer,
  cloudLoginWorker,
  cloudRegisterEmployer,
  cloudRegisterWorker,
} from '../src/data/repo';

type ThemePref = 'light' | 'dark' | 'system';

export default function AuthScreen() {
  const router = useRouter();
  const systemScheme = useColorScheme();
  const [theme, setTheme] = useState<ThemePref>('system');

  // theme load
  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem('ui:theme');
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setTheme(saved);
      }
    })();
  }, []);

  const effectiveDark =
    theme === 'dark' ? true : theme === 'light' ? false : systemScheme === 'dark';

  async function toggleTheme() {
    let next: ThemePref;
    if (theme === 'system') next = 'light';
    else if (theme === 'light') next = 'dark';
    else next = 'system';
    setTheme(next);
    await AsyncStorage.setItem('ui:theme', next);
  }

  // login fields
  const [empNo, setEmpNo] = useState('');
  const [password, setPassword] = useState('');
  const [isEmployer, setIsEmployer] = useState(true);

  // register modal
  const [showRegister, setShowRegister] = useState(false);
  const [registerTab, setRegisterTab] = useState<'employer' | 'worker'>('employer');

  // employer register
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass] = useState('');

  // worker register
  const [regWorkerEmployerNo, setRegWorkerEmployerNo] = useState('');
  const [regWorkerFullName, setRegWorkerFullName] = useState('');
  const [regWorkerTz, setRegWorkerTz] = useState('');
  const [regWorkerPass, setRegWorkerPass] = useState('');

  async function onLogin() {
    try {
      if (!empNo || !password) {
        Alert.alert('שגיאה', 'נא למלא את כל השדות');
        return;
      }
      const no = Number(empNo);
      if (isNaN(no)) {
        Alert.alert('שגיאה', 'מספר לא תקין');
        return;
      }

      if (isEmployer) {
        const emp = await cloudLoginEmployer(no, password);
        router.replace({
          pathname: '/employer-home',
          params: {
            employerNo: String(emp.employer_no),
            company: emp.name,
          },
        });
      } else {
        const worker = await cloudLoginWorker(no, password);
        router.replace({
          pathname: '/clock',
          params: {
            empNo: String(worker.emp_no),
            employerNo: String(worker.employer_no),
          },
        });
      }
    } catch (e: any) {
      Alert.alert('שגיאה', e?.message ?? 'Login failed');
    }
  }

  async function onRegisterEmployer() {
    try {
      if (!regName.trim() || !regEmail.trim() || !regPass.trim()) {
        Alert.alert('שגיאה', 'נא למלא את כל השדות');
        return;
      }
      const emp = await cloudRegisterEmployer(regName.trim(), regEmail.trim(), regPass.trim());
      Alert.alert(
        'נרשמת בהצלחה',
        `מס׳ המעסיק שלך הוא: ${emp.employer_no}\nשמור אותו!`,
        [{ text: 'אוקיי', onPress: () => setShowRegister(false) }]
      );
      setRegName('');
      setRegEmail('');
      setRegPass('');
    } catch (e: any) {
      Alert.alert('שגיאה', e?.message ?? 'כשל בהרשמה');
    }
  }

  async function onRegisterWorker() {
    try {
      if (
        !regWorkerEmployerNo.trim() ||
        !regWorkerFullName.trim() ||
        !regWorkerTz.trim() ||
        !regWorkerPass.trim()
      ) {
        Alert.alert('שגיאה', 'נא למלא את כל השדות');
        return;
      }
      const employerNo = Number(regWorkerEmployerNo.trim());
      if (isNaN(employerNo)) {
        Alert.alert('שגיאה', 'מספר מעסיק חייב להיות מספר');
        return;
      }
      const worker = await cloudRegisterWorker(
        employerNo,
        regWorkerFullName.trim(),
        regWorkerTz.trim(),
        regWorkerPass.trim()
      );
      Alert.alert(
        'העובד נרשם',
        `מס׳ העובד שלך הוא: ${worker.emp_no}.`,
        [{ text: 'אוקיי', onPress: () => setShowRegister(false) }]
      );
      setRegWorkerEmployerNo('');
      setRegWorkerFullName('');
      setRegWorkerTz('');
      setRegWorkerPass('');
    } catch (e: any) {
      Alert.alert('שגיאה', e?.message ?? 'כשל בהרשמת עובד');
    }
  }

  const text = { color: effectiveDark ? '#fff' : '#000' } as const;
  const bg = { backgroundColor: effectiveDark ? '#000' : '#fff' } as const;
  const inputBg = {
    backgroundColor: effectiveDark ? 'rgba(255,255,255,0.06)' : '#eee',
  } as const;

  return (
    <View style={[{ flex: 1, paddingTop: 80, paddingHorizontal: 16 }, bg]}>
      {/* theme toggle */}
      <TouchableOpacity
        onPress={toggleTheme}
        style={{ position: 'absolute', top: 44, left: 16, padding: 6 }}
      >
        <Text style={{ fontSize: 18, color: effectiveDark ? '#fff' : '#000' }}>
          {theme === 'dark' ? '🌙' : theme === 'light' ? '☀️' : '🌓'}
        </Text>
      </TouchableOpacity>

      <View style={{ alignItems: 'center', marginBottom: 30 }}>
        <WLLogo />
      </View>

      {/* tabs: מעסיק / עובד */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
        <TouchableOpacity
          onPress={() => setIsEmployer(true)}
          style={{
            flex: 1,
            backgroundColor: isEmployer ? '#2563eb' : 'transparent',
            borderWidth: 1,
            borderColor: '#2563eb',
            borderRadius: 12,
            paddingVertical: 10,
          }}
        >
          <Text
            style={{
              textAlign: 'center',
              color: isEmployer ? '#fff' : text.color,
              fontWeight: '700',
            }}
          >
            כניסת מעסיק
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setIsEmployer(false)}
          style={{
            flex: 1,
            backgroundColor: !isEmployer ? '#2563eb' : 'transparent',
            borderWidth: 1,
            borderColor: '#2563eb',
            borderRadius: 12,
            paddingVertical: 10,
          }}
        >
          <Text
            style={{
              textAlign: 'center',
              color: !isEmployer ? '#fff' : text.color,
              fontWeight: '700',
            }}
          >
            כניסת עובד
          </Text>
        </TouchableOpacity>
      </View>

      {/* form */}
      <View style={{ gap: 12 }}>
        <TextInput
          value={empNo}
          onChangeText={setEmpNo}
          placeholder={isEmployer ? 'מספר מעסיק' : 'מספר עובד'}
          placeholderTextColor={effectiveDark ? '#aaa' : '#666'}
          keyboardType="number-pad"
          style={{
            borderRadius: 12,
            padding: 12,
            color: text.color,
            ...inputBg,
          }}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="סיסמה"
          placeholderTextColor={effectiveDark ? '#aaa' : '#666'}
          secureTextEntry
          style={{
            borderRadius: 12,
            padding: 12,
            color: text.color,
            ...inputBg,
          }}
        />

        {/* כניסה ירוקה */}
        <TouchableOpacity
          onPress={onLogin}
          style={{
            backgroundColor: '#22c55e',
            padding: 14,
            borderRadius: 12,
            alignItems: 'center',
            marginTop: 4,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>כניסה</Text>
        </TouchableOpacity>

        {/* הרשמה כחולה */}
        <TouchableOpacity
          onPress={() => {
            setRegisterTab(isEmployer ? 'employer' : 'worker');
            setShowRegister(true);
          }}
          style={{
            backgroundColor: '#2563eb',
            padding: 12,
            borderRadius: 12,
            alignItems: 'center',
            marginTop: 6,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>הרשמה</Text>
        </TouchableOpacity>
      </View>

      {/* מודאל הרשמה – גם למעסיק וגם לעובד */}
      <Modal visible={showRegister} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.4)',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: effectiveDark ? '#111' : '#fff',
              borderRadius: 16,
              padding: 16,
              maxHeight: '85%',
            }}
          >
            {/* tabs */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <TouchableOpacity
                onPress={() => setRegisterTab('employer')}
                style={{
                  flex: 1,
                  backgroundColor: registerTab === 'employer' ? '#2563eb' : 'transparent',
                  borderWidth: 1,
                  borderColor: '#2563eb',
                  borderRadius: 10,
                  paddingVertical: 8,
                }}
              >
                <Text
                  style={{
                    textAlign: 'center',
                    color: registerTab === 'employer' ? '#fff' : (effectiveDark ? '#fff' : '#000'),
                    fontWeight: '700',
                  }}
                >
                  מעסיק
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setRegisterTab('worker')}
                style={{
                  flex: 1,
                  backgroundColor: registerTab === 'worker' ? '#2563eb' : 'transparent',
                  borderWidth: 1,
                  borderColor: '#2563eb',
                  borderRadius: 10,
                  paddingVertical: 8,
                }}
              >
                <Text
                  style={{
                    textAlign: 'center',
                    color: registerTab === 'worker' ? '#fff' : (effectiveDark ? '#fff' : '#000'),
                    fontWeight: '700',
                  }}
                >
                  עובד
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView>
              {registerTab === 'employer' ? (
                <>
                  <Text
                    style={{ fontSize: 18, fontWeight: '700', color: text.color, marginBottom: 6 }}
                  >
                    הרשמת מעסיק
                  </Text>
                  <TextInput
                    value={regName}
                    onChangeText={setRegName}
                    placeholder="שם חברה / מעסיק"
                    placeholderTextColor={effectiveDark ? '#999' : '#777'}
                    style={{
                      borderWidth: 1,
                      borderColor: effectiveDark ? '#333' : '#ddd',
                      borderRadius: 10,
                      padding: 10,
                      color: text.color,
                      marginBottom: 6,
                    }}
                  />
                  <TextInput
                    value={regEmail}
                    onChangeText={setRegEmail}
                    placeholder="אימייל"
                    placeholderTextColor={effectiveDark ? '#999' : '#777'}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={{
                      borderWidth: 1,
                      borderColor: effectiveDark ? '#333' : '#ddd',
                      borderRadius: 10,
                      padding: 10,
                      color: text.color,
                      marginBottom: 6,
                    }}
                  />
                  <TextInput
                    value={regPass}
                    onChangeText={setRegPass}
                    placeholder="סיסמה"
                    placeholderTextColor={effectiveDark ? '#999' : '#777'}
                    secureTextEntry
                    style={{
                      borderWidth: 1,
                      borderColor: effectiveDark ? '#333' : '#ddd',
                      borderRadius: 10,
                      padding: 10,
                      color: text.color,
                      marginBottom: 10,
                    }}
                  />
                  <TouchableOpacity
                    onPress={onRegisterEmployer}
                    style={{
                      backgroundColor: '#2563eb',
                      padding: 12,
                      borderRadius: 10,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '700' }}>צור חשבון</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text
                    style={{ fontSize: 18, fontWeight: '700', color: text.color, marginBottom: 6 }}
                  >
                    הרשמת עובד
                  </Text>
                  <TextInput
                    value={regWorkerEmployerNo}
                    onChangeText={setRegWorkerEmployerNo}
                    placeholder="מס׳ מעסיק"
                    keyboardType="number-pad"
                    placeholderTextColor={effectiveDark ? '#999' : '#777'}
                    style={{
                      borderWidth: 1,
                      borderColor: effectiveDark ? '#333' : '#ddd',
                      borderRadius: 10,
                      padding: 10,
                      color: text.color,
                      marginBottom: 6,
                    }}
                  />
                  <TextInput
                    value={regWorkerFullName}
                    onChangeText={setRegWorkerFullName}
                    placeholder="שם מלא"
                    placeholderTextColor={effectiveDark ? '#999' : '#777'}
                    style={{
                      borderWidth: 1,
                      borderColor: effectiveDark ? '#333' : '#ddd',
                      borderRadius: 10,
                      padding: 10,
                      color: text.color,
                      marginBottom: 6,
                    }}
                  />
                  <TextInput
                    value={regWorkerTz}
                    onChangeText={setRegWorkerTz}
                    placeholder="תעודת זהות"
                    placeholderTextColor={effectiveDark ? '#999' : '#777'}
                    style={{
                      borderWidth: 1,
                      borderColor: effectiveDark ? '#333' : '#ddd',
                      borderRadius: 10,
                      padding: 10,
                      color: text.color,
                      marginBottom: 6,
                    }}
                  />
                  <TextInput
                    value={regWorkerPass}
                    onChangeText={setRegWorkerPass}
                    placeholder="סיסמה"
                    secureTextEntry
                    placeholderTextColor={effectiveDark ? '#999' : '#777'}
                    style={{
                      borderWidth: 1,
                      borderColor: effectiveDark ? '#333' : '#ddd',
                      borderRadius: 10,
                      padding: 10,
                      color: text.color,
                      marginBottom: 10,
                    }}
                  />
                  <TouchableOpacity
                    onPress={onRegisterWorker}
                    style={{
                      backgroundColor: '#2563eb',
                      padding: 12,
                      borderRadius: 10,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '700' }}>צרף עובד</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>

            <TouchableOpacity onPress={() => setShowRegister(false)} style={{ marginTop: 10 }}>
              <Text style={{ color: text.color, textAlign: 'center' }}>סגור</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}