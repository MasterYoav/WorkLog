// src/data/repo.ts
// שכבת הדאטה שלנו – רק ענן (Supabase) + מדיה לוקאלית לפרויקטים

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../lib/supabase';
import {
  hashPassword,
  isStrongPassword,
  isValidEmail,
  passwordMatches,
  sanitizeEmail,
  sanitizeNumericText,
  sanitizeText,
} from '../lib/security';
const FS = FileSystem as any;

// ---------- טיפוסים מהדאטאבייס ----------

export type EmployerRow = {
  employer_no: number;
  name: string;
  email: string;
  password_hash: string;
  created_at: string;
  // לא חובה בטבלה – אבל ננסה לקרוא
  punch_mode?: 'site' | 'anywhere' | null;
};

export type WorkerRow = {
  emp_no: number;
  employer_no: number;
  full_name: string;
  tz: string;
  password_hash: string;
  created_at: string;
  punch_mode?: 'site' | 'anywhere' | null;
};

export type ProjectRow = {
  id: number;
  employer_no: number;
  name: string;
  location: string;
  created_at: string;
};

export type PunchInput = {
  kind: 'in' | 'out';
  ts: string;
  started_at?: string | null;
  duration_ms?: number | null;
  lat?: number | null;
  lng?: number | null;
  accuracy?: number | null;
  address_label?: string | null;
};

// ---------- עזר קטן לזמנים ----------
export function formatHm(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
export function monthStartEnd(year: number, month0: number) {
  const start = new Date(Date.UTC(year, month0, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month0 + 1, 1, 0, 0, 0, 0));
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

// =====================================================
//                  AUTH – EMPLOYERS
// =====================================================

export async function cloudRegisterEmployer(
  name: string,
  email: string,
  password: string
): Promise<EmployerRow> {
  const cleanName = sanitizeText(name, 120);
  const cleanEmail = sanitizeEmail(email);
  if (!cleanName) throw new Error('Name is required');
  if (!isValidEmail(cleanEmail)) throw new Error('Invalid email');
  if (!isStrongPassword(password)) throw new Error('Password must be at least 8 characters');

  const passwordHash = await hashPassword(password);

  const { data, error } = await supabase
    .from('employers')
    .insert({
      name: cleanName,
      email: cleanEmail,
      password_hash: passwordHash,
      punch_mode: 'site',
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as EmployerRow;
}

export async function cloudLoginEmployer(
  employerNo: number,
  password: string
): Promise<EmployerRow> {
  const cleanNo = Number(sanitizeNumericText(String(employerNo), 10));
  if (!Number.isFinite(cleanNo)) throw new Error('Invalid employer number');

  const { data, error } = await supabase
    .from('employers')
    .select('*')
    .eq('employer_no', cleanNo)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Employer not found');
  if (!(await passwordMatches(data.password_hash, password))) throw new Error('Invalid password');
  return data as EmployerRow;
}

export async function changeEmployerPasswordCloud(
  employerNo: number,
  oldPass: string,
  newPass: string
) {
  // נוודא קודם שהישן נכון
  if (!isStrongPassword(newPass)) {
    throw new Error('New password must be at least 8 characters');
  }

  const { data, error } = await supabase
    .from('employers')
    .select('password_hash')
    .eq('employer_no', employerNo)
    .maybeSingle();
  if (error) throw error;
  if (!data || !(await passwordMatches(data.password_hash, oldPass))) {
    throw new Error('סיסמה נוכחית שגויה');
  }

  const newHash = await hashPassword(newPass);

  const { error: updErr } = await supabase
    .from('employers')
    .update({ password_hash: newHash })
    .eq('employer_no', employerNo);
  if (updErr) throw updErr;
}

// punch_mode למעסיק
export async function updateEmployerPunchMode(
  employerNo: number,
  mode: 'site' | 'anywhere'
) {
  const { error } = await supabase
    .from('employers')
    .update({ punch_mode: mode })
    .eq('employer_no', employerNo);
  if (error) throw error;
}

// =====================================================
//                  AUTH – WORKERS
// =====================================================

export async function cloudRegisterWorker(
  employerNo: number,
  fullName: string,
  tz: string,
  password: string
): Promise<WorkerRow> {
  const cleanName = sanitizeText(fullName, 120);
  const cleanTz = sanitizeNumericText(tz, 20);
  if (!cleanName) throw new Error('Full name is required');
  if (cleanTz.length < 8) throw new Error('Invalid ID number');
  if (!isStrongPassword(password)) throw new Error('Password must be at least 8 characters');

  const passwordHash = await hashPassword(password);

  const { data, error } = await supabase
    .from('workers')
    .insert({
      employer_no: employerNo,
      full_name: cleanName,
      tz: cleanTz,
      password_hash: passwordHash,
      punch_mode: 'site',
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as WorkerRow;
}

export async function cloudLoginWorker(empNo: number, password: string): Promise<WorkerRow> {
  const { data, error } = await supabase.from('workers').select('*').eq('emp_no', empNo).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Worker not found');
  if (!(await passwordMatches(data.password_hash, password))) throw new Error('Invalid password');
  return data as WorkerRow;
}

// זה הפונקציה שהייתה חסרה ל-clock.tsx
export async function getWorkerProfile(empNo: number): Promise<WorkerRow | null> {
  const { data, error } = await supabase.from('workers').select('*').eq('emp_no', empNo).maybeSingle();
  if (error) throw error;
  return (data as WorkerRow) ?? null;
}

// לשנות מצב החתמה לעובד
export async function updateWorkerPunchMode(
  empNo: number,
  mode: 'site' | 'anywhere'
) {
  const { error } = await supabase
    .from('workers')
    .update({ punch_mode: mode })
    .eq('emp_no', empNo);
  if (error) throw error;
}

// =====================================================
//               PROJECTS (cloud-only)
// =====================================================

export async function createProjectCloud(
  employerNo: number,
  name: string,
  location: string
): Promise<ProjectRow> {
  const cleanName = sanitizeText(name, 120);
  const cleanLocation = sanitizeText(location, 240);
  if (!cleanName) throw new Error('Project name is required');

  const { data, error } = await supabase
    .from('projects')
    .insert({
      employer_no: employerNo,
      name: cleanName,
      location: cleanLocation,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as ProjectRow;
}

export async function listProjectsCloud(employerNo: number): Promise<ProjectRow[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('employer_no', employerNo)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProjectRow[];
}

// =====================================================
//               WORKERS LIST + TOTALS
// =====================================================

// נטען את עובדי המעסיק
export async function listEmployerWorkersCloud(
  employerNo: number
): Promise<WorkerRow[]> {
  const { data, error } = await supabase
    .from('workers')
    .select('*')
    .eq('employer_no', employerNo)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as WorkerRow[];
}

// סכומי שעות לפי punch-out מהענן (פשוט לפי worker)
// בשביל מסך “העובדים שלי” – אפשר להביא הכול ולבסס בצד הלקוח
export async function listWorkerPunchTotalsCloud(
  employerNo: number
): Promise<Record<number, number>> {
  // נביא את כל ה-workers של המעסיק
  const workers = await listEmployerWorkersCloud(employerNo);
  const totals: Record<number, number> = {};
  // במקום group-by בצד השרת – נעשה שאילתה אחת לכל עובד (אפשר לשפר ל-RPC)
  for (const w of workers) {
    const { data, error } = await supabase
      .from('punches')
      .select('duration_ms')
      .eq('subject_type', 'worker')
      .eq('subject_id', w.emp_no)
      .eq('kind', 'out');
    if (error) continue;
    let sum = 0;
    (data ?? []).forEach((r: any) => {
      sum += Number(r.duration_ms ?? 0);
    });
    totals[w.emp_no] = sum;
  }
  return totals;
}

// =====================================================
//     PUNCHES – לפי RPC (כמו שהיה) אבל בלי תור לוקאלי
// =====================================================

export async function recordPunchWorker(
  empNo: number,
  input: PunchInput
) {
  const { error } = await supabase.rpc('punch_worker', {
    _emp_no: empNo,
    _kind: input.kind,
    _ts: input.ts,
    _lat: input.lat ?? null,
    _lng: input.lng ?? null,
    _accuracy: input.accuracy ?? null,
    _address_label: input.address_label ?? null,
    _started_at: input.started_at ?? null,
    _duration_ms: input.duration_ms ?? null,
  });
  if (error) throw error;
}

export async function recordPunchEmployer(
  employerNo: number,
  input: PunchInput
) {
  const { error } = await supabase.rpc('punch_employer', {
    _employer_no: employerNo,
    _kind: input.kind,
    _ts: input.ts,
    _lat: input.lat ?? null,
    _lng: input.lng ?? null,
    _accuracy: input.accuracy ?? null,
    _address_label: input.address_label ?? null,
    _started_at: input.started_at ?? null,
    _duration_ms: input.duration_ms ?? null,
  });
  if (error) throw error;
}

// =====================================================
//        PROJECT MEDIA – local only (נשאר כמו שביקשת)
// =====================================================

const MEDIA_ROOT: string = `${(FS.documentDirectory || FS.cacheDirectory || '')}projects/`;

function ensureExt(name?: string, fallbackExt?: string) {
  if (!name) return fallbackExt ? `file${fallbackExt}` : `file`;
  return /\.[a-z0-9]+$/i.test(name) ? name : fallbackExt ? `${name}${fallbackExt}` : name;
}
function guessExtByMime(mime?: string | null) {
  if (!mime) return '';
  if (mime.startsWith('image/')) return '.' + mime.slice(6);
  if (mime.startsWith('video/')) return '.' + mime.slice(6);
  const map: Record<string, string> = {
    'application/pdf': '.pdf',
    'text/plain': '.txt',
    'application/zip': '.zip',
  };
  return map[mime] ?? '';
}

// נשמור קובץ בפרויקט
export async function saveProjectMediaFromUri(
  projectId: number,
  sourceUri: string,
  mime?: string | null,
  originalName?: string | null
) {
  const folder = `${MEDIA_ROOT}${projectId}/`;
  await FileSystem.makeDirectoryAsync(folder, { intermediates: true }).catch(() => {});
  const ext = guessExtByMime(mime) || (originalName ? originalName.match(/\.[a-z0-9]+$/i)?.[0] || '' : '');
  const safeName = ensureExt(originalName ?? `media-${Date.now()}`, ext);
  const dest = folder + `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
  await FileSystem.copyAsync({ from: sourceUri, to: dest });

  // נשמור ברשימת המדיה המקומית
  const key = `media:${projectId}`;
  const raw = await AsyncStorage.getItem(key);
  const list = raw ? (JSON.parse(raw) as any[]) : [];
  list.push({
    id: dest,
    uri: dest,
    type: mime?.startsWith('video/') ? 'video' : mime?.startsWith('image/') ? 'image' : 'file',
    name: safeName,
    createdAt: new Date().toISOString(),
  });
  await AsyncStorage.setItem(key, JSON.stringify(list));

  return dest;
}

// לקרוא מדיה
export async function listProjectMediaLocal(projectId: number) {
  const key = `media:${projectId}`;
  const raw = await AsyncStorage.getItem(key);
  return raw ? (JSON.parse(raw) as any[]) : [];
}

// למחוק מדיה
export async function deleteProjectMediaLocal(projectId: number, ids: string[]) {
  const key = `media:${projectId}`;
  const raw = await AsyncStorage.getItem(key);
  const list = raw ? (JSON.parse(raw) as any[]) : [];
  const keep = list.filter((m: any) => !ids.includes(m.id) && !ids.includes(m.uri));
  await AsyncStorage.setItem(key, JSON.stringify(keep));
  // מחיקת הקבצים עצמם
  for (const id of ids) {
    try {
      await FileSystem.deleteAsync(id, { idempotent: true });
    } catch {}
  }
  return keep;
}