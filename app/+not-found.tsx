import { Link } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function NotFound() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 8 }}>Not Found</Text>
        <Text style={{ opacity: 0.7, marginBottom: 20 }}>The page you’re looking for doesn’t exist.</Text>
        <Link href="/auth" asChild>
          <TouchableOpacity style={{ paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, backgroundColor: '#2563eb' }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Go to Login</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </SafeAreaView>
  );
}