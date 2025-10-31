import { createClient } from '@supabase/supabase-js';

const url  = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// 🔎 לוג קצר שיעלה בכל פתיחה של האפליקציה
console.log('[Supabase]', { url: url?.slice(0, 30) ?? 'MISSING', anon: anon ? 'OK' : 'MISSING' });

export const supabase = createClient(url!, anon!);