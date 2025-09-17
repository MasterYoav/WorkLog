// src/data/repo.ts
//
// Data layer:
// - Cloud (Supabase) עבור פרויקטים/נוכחות (כפי שהיה)
// - מדיה של פרויקטים: שמירה מקומית בלבד בתוך sandbox של האפליקציה
// - מראה לוקאלי + תור אופליין לפעולות ענן (ללא מדיה)
//
// דרישות חבילות:
//   @supabase/supabase-js  (אם משתמשים בענן לפרויקטים/נוכחות)
//   expo-file-system
//   base-64  (כבר לא בשימוש במדיה המקומית, נשאר אם מימשת בעבר)
//

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../lib/supabase';
const FS = FileSystem as any;

import {
    addProjectMedia,
    appendLocalPunch,
    createProject as createProjectLocal,
    listProjectMedia,
    listProjects as listProjectsLocal,
    Project,
    removeProjectMedia,
} from '../lib/storage';

// ---------- Types ----------
type EmployerRow = {
  employer_no: number;
  name: string;
  email: string;
  password_hash: string;
  created_at: string;
};

type WorkerRow = {
  emp_no: number;
  employer_no: number;
  full_name: string;
  tz: string;
  password_hash: string;
  created_at: string;
};

type PunchRow = {
  id?: number;
  subject_type: 'worker' | 'employer';
  subject_id: number;
  kind: 'in' | 'out';
  ts: string;
  started_at?: string | null;
  duration_ms?: number | null;
  lat?: number | null;
  lng?: number | null;
  accuracy?: number | null;
  address_label?: string | null;
};

type ProjectRow = {
  id?: number;
  employer_no: number;
  name: string;
  location: string;
  created_at?: string;
};

export type ProjectMediaRow = {
  id?: string; // uuid (בענן) — לא בשימוש כרגע
  project_id: number;
  file_path: string; // נתיב קובץ מקומי (sandbox)
  mime?: string | null;
  created_at?: string;
};

// ---------- Offline queue (לענן בלבד, לא למדיה) ----------
type PendingOp =
  | { id: string; table: 'punches'; payload: PunchRow }
  | { id: string; table: 'projects'; payload: ProjectRow };

const PENDING_KEY = 'repo:pending_ops';

async function loadPending(): Promise<PendingOp[]> {
  const raw = await AsyncStorage.getItem(PENDING_KEY);
  return raw ? (JSON.parse(raw) as PendingOp[]) : [];
}
async function savePending(list: PendingOp[]) {
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(list));
}
function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function cloudInsert<T extends object>(table: string, payload: T): Promise<void> {
  const { error } = await supabase.from(table).insert(payload as any);
  if (error) throw error;
}

export async function flushPending(): Promise<{ ok: number; failed: number }> {
  let list = await loadPending();
  if (list.length === 0) return { ok: 0, failed: 0 };
  const next: PendingOp[] = [];
  let ok = 0;
  for (const op of list) {
    try {
      await cloudInsert(op.table, op.payload);
      ok++;
    } catch {
      next.push(op);
    }
  }
  await savePending(next);
  return { ok, failed: next.length };
}

// ---------- Auth (ענן) ----------
export async function cloudLoginEmployer(employerNo: number, password: string): Promise<EmployerRow> {
  const { data, error } = await supabase.from('employers').select('*').eq('employer_no', employerNo).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Employer not found');
  if (data.password_hash !== password) throw new Error('Invalid password');
  return data;
}
export async function cloudLoginWorker(empNo: number, password: string): Promise<WorkerRow> {
  const { data, error } = await supabase.from('workers').select('*').eq('emp_no', empNo).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Worker not found');
  if (data.password_hash !== password) throw new Error('Invalid password');
  return data;
}
export async function cloudRegisterEmployer(name: string, email: string, password: string): Promise<EmployerRow> {
  const payload: Partial<EmployerRow> = { name, email, password_hash: password };
  const { data, error } = await supabase.from('employers').insert(payload).select('*').single();
  if (error) throw error;
  return data;
}
export async function cloudRegisterWorker(
  employerNo: number,
  fullName: string,
  tz: string,
  password: string
): Promise<WorkerRow> {
  const payload: Partial<WorkerRow> = {
    employer_no: employerNo,
    full_name: fullName,
    tz,
    password_hash: password,
  };
  const { data, error } = await supabase.from('workers').insert(payload).select('*').single();
  if (error) throw error;
  return data;
}

// ---------- Punches ----------
type PunchInput = {
  kind: 'in' | 'out';
  ts: string;
  started_at?: string;
  duration_ms?: number;
  lat?: number;
  lng?: number;
  accuracy?: number | null;
  address_label?: string;
};

export async function recordPunchWorker(empNo: number, input: PunchInput) {
  const row: PunchRow = {
    subject_type: 'worker',
    subject_id: empNo,
    kind: input.kind,
    ts: input.ts,
    started_at: input.started_at ?? null,
    duration_ms: input.duration_ms ?? null,
    lat: input.lat,
    lng: input.lng,
    accuracy: input.accuracy ?? null,
    address_label: input.address_label ?? null,
  };

  try {
    await cloudInsert('punches', row);
  } catch {
    const pending = await loadPending();
    pending.push({ id: uid(), table: 'punches', payload: row });
    await savePending(pending);
  }

  await appendLocalPunch(String(empNo), {
    kind: input.kind,
    ts: input.ts,
    lat: input.lat ?? 0,
    lng: input.lng ?? 0,
    acc: input.accuracy,
    address_label: input.address_label,
    started_at: input.started_at ?? undefined,
    duration_ms: input.duration_ms,
  });
}

export async function recordPunchEmployer(employerNo: number, input: PunchInput) {
  const row: PunchRow = {
    subject_type: 'employer',
    subject_id: employerNo,
    kind: input.kind,
    ts: input.ts,
    started_at: input.started_at ?? null,
    duration_ms: input.duration_ms ?? null,
    lat: input.lat,
    lng: input.lng,
    accuracy: input.accuracy ?? null,
    address_label: input.address_label ?? null,
  };

  try {
    await cloudInsert('punches', row);
  } catch {
    const pending = await loadPending();
    pending.push({ id: uid(), table: 'punches', payload: row });
    await savePending(pending);
  }

  await appendLocalPunch(String(employerNo), {
    kind: input.kind,
    ts: input.ts,
    lat: input.lat ?? 0,
    lng: input.lng ?? 0,
    acc: input.accuracy,
    address_label: input.address_label,
    started_at: input.started_at ?? undefined,
    duration_ms: input.duration_ms,
  });
}

// ---------- Projects (ענן עם נפילה ללוקאל) ----------
export async function createProjectCloud(employerNo: number, name: string, location: string): Promise<ProjectRow> {
  const payload: ProjectRow = { employer_no: employerNo, name, location };
  try {
    const { data, error } = await supabase.from('projects').insert(payload).select('*').single();
    if (error) throw error;
    await createProjectLocal(String(employerNo), data.name, data.location);
    return data;
  } catch {
    const pending = await loadPending();
    pending.push({ id: uid(), table: 'projects', payload });
    await savePending(pending);
    const local = await createProjectLocal(String(employerNo), name, location);
    return { id: local.id, employer_no: employerNo, name, location, created_at: local.createdAt };
  }
}

export async function listProjectsCloudFirst(employerNo: number): Promise<Project[]> {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('employer_no', employerNo)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(p => ({
      id: p.id!,
      employerNo: p.employer_no,
      name: p.name,
      location: p.location,
      createdAt: p.created_at!,
    }));
  } catch {
    return await listProjectsLocal(String(employerNo));
  }
}

// ---------- Project media — LOCAL-ONLY ----------
//
// מבצע העתקה של קובץ/תמונה/וידאו לתיקיית Documents של האפליקציה,
// בתוך projects/<projectId>/filename, ומוסיף רשומת מדיה ל-AsyncStorage.
//

// LOCAL media root (safe for TS + runtime)
const MEDIA_ROOT: string = `${(FS.documentDirectory || FS.cacheDirectory || '')}projects/`;

function ensureExt(name?: string, fallbackExt?: string) {
  if (!name) return fallbackExt ? `file${fallbackExt}` : `file`;
  return /\.[a-z0-9]+$/i.test(name) ? name : (fallbackExt ? `${name}${fallbackExt}` : name);
}
function guessExtByMime(mime?: string) {
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

export async function saveProjectMediaFromUri(
  projectId: number,
  sourceUri: string,
  mime?: string,
  originalName?: string
) {
  const folder = `${MEDIA_ROOT}${projectId}/`;
  await FileSystem.makeDirectoryAsync(folder, { intermediates: true }).catch(() => {});

  const ext = guessExtByMime(mime) || (originalName ? originalName.match(/\.[a-z0-9]+$/i)?.[0] || '' : '');
  const safeName = ensureExt(originalName ?? `media-${Date.now()}`, ext);
  const dest = folder + `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;

  await FileSystem.copyAsync({ from: sourceUri, to: dest });

  await addProjectMedia(projectId, {
    id: dest, // משתמשים בנתיב כ-id ייחודי
    uri: dest,
    type: mime?.startsWith('video/') ? 'video' : mime?.startsWith('image/') ? 'image' : 'file',
    name: safeName,
    createdAt: new Date().toISOString(),
  });

  return { project_id: projectId, file_path: dest, mime, created_at: new Date().toISOString() } as ProjectMediaRow;
}

export async function listProjectMediaLocal(projectId: number) {
  return await listProjectMedia(projectId);
}

export async function deleteProjectMediaLocal(projectId: number, mediaIds: string[]) {
  // מחיקת קבצים עצמם
  for (const id of mediaIds) {
    try { await FileSystem.deleteAsync(id, { idempotent: true }); } catch {}
  }
  // מחיקת הרשומות מה-AsyncStorage
  await removeProjectMedia(projectId, mediaIds);
}