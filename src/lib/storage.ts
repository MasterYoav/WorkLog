import AsyncStorage from '@react-native-async-storage/async-storage';
import { hashPassword, passwordMatches, sanitizeEmail, sanitizeNumericText, sanitizeText } from './security';

export type Employer = { employerNo: number; name: string; password: string; email: string; createdAt: string; };
export type Worker = { empNo: number; fullName: string; tz: string; password: string; employerNo: number; createdAt: string; };
export type Project = { id: number; employerNo: number; name: string; location: string; createdAt: string; };
export type Media = { id: string; uri: string; type: 'image'|'video'|'file'; name?: string; createdAt: string; };
export type Punch = { kind: 'in'|'out'; ts: string; lat: number; lng: number; acc?: number|null; address?: any; address_label?: string; started_at?: string; duration_ms?: number; };

const K = {
  employers: 'employers',
  workers: 'workers',
  seqEmployer: 'seq:employer',
  seqWorker: 'seq:worker',
  projects: 'projects',
  punchesPrefix: 'punches:',      // punches:<id>
  shiftPrefix: 'shift:',          // shift:<id>
  mediaPrefix: 'media:',          // media:<projectId>
};

async function get<T>(key:string, def:T): Promise<T> {
  const s = await AsyncStorage.getItem(key); return s ? JSON.parse(s) as T : def;
}
async function set<T>(key:string, val:T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(val));
}
function nextId(x:number){ return (x||0)+1; }
function randomPassword(len=8){ const chars='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'; return Array.from({length:len},()=>chars[Math.floor(Math.random()*chars.length)]).join(''); }

// ===== Employers (UPDATED)
export async function registerEmployer(name:string, password:string, email:string){
  const employers = await get<Employer[]>(K.employers, []);
  const cleanName = sanitizeText(name, 120);
  const cleanEmail = sanitizeEmail(email);
  if (cleanEmail && employers.some(e => e.email?.toLowerCase() === cleanEmail)) {
    throw new Error('קיים כבר מעסיק עם אימייל זה');
  }

  const seq = await get<number>(K.seqEmployer, 1000);
  const maxExisting = employers.reduce((m, e) => Math.max(m, e.employerNo), 0);
  const employerNo = Math.max(seq, maxExisting) + 1;

  const passwordHash = await hashPassword(password);
  const emp: Employer = { employerNo, name: cleanName, password: passwordHash, email: cleanEmail, createdAt: new Date().toISOString() };
  employers.push(emp);
  await set(K.employers, employers);
  await set(K.seqEmployer, employerNo);
  return emp;
}

export async function loginEmployer(employerNoStr:string, password:string){
  const employers = await get<Employer[]>(K.employers, []);
  const no = Number(employerNoStr);
  const emp = employers.find(e => e.employerNo === no);
  if (!emp) throw new Error('מעסיק לא נמצא');
  if (!(await passwordMatches(emp.password, password))) throw new Error('סיסמה שגויה');
  return emp;
}

export async function resetEmployerPassword(email:string){
  const employers = await get<Employer[]>(K.employers, []);
  const cleanEmail = sanitizeEmail(email);
  const emp = employers.find(e => e.email?.toLowerCase() === cleanEmail);
  if (!emp) throw new Error('מעסיק עם אימייל זה לא נמצא');
  const newPassword = randomPassword(10);
  emp.password = await hashPassword(newPassword);
  await set(K.employers, employers);
  return { newPassword, employer: emp };
}

export async function changeEmployerPassword(employerNoStr:string, oldPass:string, newPass:string){
  const employers = await get<Employer[]>(K.employers, []);
  const no = Number(employerNoStr);
  const emp = employers.find(e => e.employerNo === no);
  if (!emp) throw new Error('מעסיק לא נמצא');
  if (!(await passwordMatches(emp.password, oldPass))) throw new Error('סיסמה נוכחית שגויה');
  emp.password = await hashPassword(newPass);
  await set(K.employers, employers);
}

// ===== Workers (UPDATED)
export async function registerEmployee(fullName:string, tz:string, password:string, employerNoStr:string){
  const workers = await get<Worker[]>(K.workers, []);
  const employers = await get<Employer[]>(K.employers, []);
  const employerNo = Number(sanitizeNumericText(employerNoStr, 10));
  const cleanTz = sanitizeNumericText(tz, 20);
  const cleanName = sanitizeText(fullName, 120);
  if (!employers.find(e => e.employerNo === employerNo)) throw new Error('מספר מעסיק לא קיים');

  // Enforce unique TZ per employer (prevents duplicate "ID" within same company)
  if (workers.some(w => w.employerNo === employerNo && w.tz === cleanTz)) {
    throw new Error('כבר קיים עובד עם תעודת זהות זו אצל המעסיק');
  }

  // Robust next id: max(existing, seq) + 1
  const seq = await get<number>(K.seqWorker, 5000);
  const maxExisting = workers.reduce((m, w) => Math.max(m, w.empNo), 0);
  const empNo = Math.max(seq, maxExisting) + 1;

  const passwordHash = await hashPassword(password);
  const w: Worker = { empNo, fullName: cleanName, tz: cleanTz, password: passwordHash, employerNo, createdAt: new Date().toISOString() };
  workers.push(w);
  await set(K.workers, workers);
  await set(K.seqWorker, empNo);
  return w;
}

export async function loginEmployee(empNoStr:string, password:string){
  const workers = await get<Worker[]>(K.workers, []);
  const no = Number(empNoStr);
  const w = workers.find(x => x.empNo === no);
  if (!w) throw new Error('עובד לא נמצא');
  if (!(await passwordMatches(w.password, password))) throw new Error('סיסמה שגויה');
  return w;
}

export async function resetPasswordToTz(empNoStr:string){
  const workers = await get<Worker[]>(K.workers, []);
  const no = Number(empNoStr);
  const w = workers.find(x => x.empNo === no);
  if (!w) throw new Error('עובד לא נמצא');
  w.password = await hashPassword(w.tz);
  await set(K.workers, workers);
}

export async function listEmployerWorkers(employerNoStr:string){
  const employerNo = Number(employerNoStr);
  const workers = await get<Worker[]>(K.workers, []);
  return workers.filter(w => w.employerNo === employerNo).sort((a,b)=> a.createdAt.localeCompare(b.createdAt));
}

// ===== Punches & shift
export async function saveShiftStart(id:string, iso:string){ await AsyncStorage.setItem(K.shiftPrefix+id, iso); }
export async function loadShiftStart(id:string){ return await AsyncStorage.getItem(K.shiftPrefix+id); }
export async function clearShiftStart(id:string){ await AsyncStorage.removeItem(K.shiftPrefix+id); }

export async function appendLocalPunch(id:string, punch:Punch){
  const key = K.punchesPrefix + id;
  const arr = await get<Punch[]>(key, []);
  arr.push(punch);
  await set(key, arr);
}
export async function loadLocalPunches(id:string){ return await get<Punch[]>(K.punchesPrefix+id, []); }

// ===== Projects & media
export async function createProject(employerNoStr:string, name:string, location:string){
  const employerNo = Number(employerNoStr);
  const projects = await get<Project[]>(K.projects, []);
  const id = (projects.reduce((m,p)=>Math.max(m,p.id), 0) || 0) + 1;
  const p: Project = { id, employerNo, name, location, createdAt: new Date().toISOString() };
  projects.push(p);
  await set(K.projects, projects);
  return p;
}
export async function listProjects(employerNoStr:string){
  const employerNo = Number(employerNoStr);
  const projects = await get<Project[]>(K.projects, []);
  // Newest first by createdAt, then by id (desc) to break ties
  return projects
    .filter(p => p.employerNo === employerNo)
    .sort((a,b) => b.createdAt.localeCompare(a.createdAt) || (b.id - a.id));
}

// Media helpers (placeholders if you need later)
export async function listProjectMedia(projectId:number){ return await get<Media[]>(K.mediaPrefix+projectId, []); }
export async function addProjectMedia(projectId:number, media:Media){ const key=K.mediaPrefix+projectId; const arr=await get<Media[]>(key, []); arr.push(media); await set(key, arr); }
export async function removeProjectMedia(projectId:number, ids:string[]){ const key=K.mediaPrefix+projectId; const arr=await get<Media[]>(key, []); await set(key, arr.filter(m=>!ids.includes(m.id))); }