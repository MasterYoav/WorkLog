![WorkLog Logo](./assets/logo.png)

# WorkLog Mobile

📱 Cross-platform mobile app (React Native + Expo) for **employers and workers** to track work hours, manage projects, and handle attendance — all powered by **Supabase**.  
🎉 Version **1.0** – Official Release  

Data (employers, workers, projects, punches) is synced with Supabase, while media files are stored locally on the device sandbox.

---

## ✨ Features (v1.0)

### 👥 Employer & Worker Accounts
- Separate **sign-in and registration** for employers and workers  
- Automatic employer ID assignment (`employer_no`)  
- Worker registration linked to an existing employer  
- Password reset flow with clipboard copy  
- Prevents duplicate IDs in the cloud (unique per table)

### 🕒 Attendance Clock
- Employers can punch **in/out from anywhere** (location always logged)  
- Real-time shift timer display  
- Stored in Supabase table `punches` via RPC calls  
- Location accuracy + haversine validation  
- Offline punches queued and synced automatically

### 👷 Worker Management
- View all workers and their total hours (calculated server-side)  
- Each worker has an individual **attendance policy**:
  - “From workplace only” (default)
  - “From anywhere”
- Policy changes update instantly in Supabase (`workers.punch_mode`)
- Floating “Monthly Summary” button on workers page

### 🧱 Projects
- Employers can **create / view / delete** projects  
- Stored in Supabase (`projects` table)  
- Local fallback with offline cache  
- Add media (photos, videos, files) — saved locally, not in the cloud  
- Project details open in a centered modal card  
- Delete confirmation dialog with Supabase policy check

### 🌓 Theming
- Auto light/dark mode using `useColorScheme`  
- Manual theme toggle (☀️ / 🌙) on login screen and personal info page  
- All buttons styled consistently:
  - 🟢 Green → main action (login / clock in)  
  - 🔵 Blue → secondary actions (register / update)  
  - 🔴 Red → destructive (delete / logout)

---

## 🏗️ Tech Stack

- **Expo** (React Native runtime)  
- **expo-router** for file-based navigation  
- **Supabase** for backend (Postgres + RLS + RPC)  
- **AsyncStorage** for offline/local data  
- **expo-file-system** for local project media  
- **expo-clipboard** for password recovery  
- **TypeScript** for full type safety  

---

## 🔑 Environment Variables

Create a `.env` file at the root (never commit real keys):

```env
EXPO_PUBLIC_SUPABASE_URL="https://xxxx.supabase.co"
EXPO_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
```

For CI/CD (EAS build):  
Use **Expo Secrets** or GitHub Actions secrets to inject these values securely.

---

## 📂 Project Structure

```
WorkLog-mobile/
├── app/
│   ├── _layout.tsx              # Root layout (theme, router)
│   ├── auth.tsx                 # Worker login & registration
│   ├── employer-auth.tsx        # Employer login, registration, password reset
│   ├── employer-home.tsx        # Main employer panel (menu, clock, workers, projects)
│   ├── employer-project.tsx     # Project modal view + file/media upload + delete
│   └── employer-workers.tsx     # Monthly summary per worker
├── components/
│   └── WLLogo.tsx               # Reusable large logo component
├── src/
│   ├── data/
│   │   └── repo.ts              # Supabase & offline repository logic
│   ├── lib/
│   │   ├── supabase.ts          # Supabase client
│   │   ├── location.ts          # GPS + geocode helpers
│   │   └── storage.ts           # Local storage for media
├── assets/
│   └── logo.png
└── README.md
```

---

## 🚀 Running Locally

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # fill in real Supabase values
   ```

3. **Start development server**
   ```bash
   npx expo start
   ```

4. **Run verification + tests**
   ```bash
   npm run verify
   npm run test:cov
   ```

Security baseline and release-hardening checklist: `docs/SECURITY_CHECKLIST.md`.

---

## 📦 Android APK Releases (GitHub)

APK files are published automatically on version tags via:

- `.github/workflows/release-apk.yml`

### Trigger a release

```bash
git tag v1.0.1
git push origin v1.0.1
```

The workflow will attach these artifacts to the GitHub Release:

- `WorkLog-debug.apk`
- `WorkLog-release-unsigned.apk`

> Note: `release-unsigned` is not Play Store-ready by itself. For Play Store production, sign with your release keystore or use EAS signed builds.

## 📦 Building (EAS)

```bash
eas build --platform ios
eas build --platform android
```

Secrets are managed via **Expo → Project → Secrets**.  
Ensure your `.env` is not committed to git.

---

## 🧩 Supabase Setup Notes

To allow deleting projects directly from the app, make sure you add this policy:

```sql
alter table public.projects enable row level security;

drop policy if exists projects_delete_all on public.projects;

create policy projects_delete_all
on public.projects
for delete
using (true);
```

If you prefer owner-based deletion:
```sql
create policy projects_delete_own
on public.projects
for delete
using (auth.role() = 'authenticated' OR true)
with check (true);
```

---

## 🧪 Testing Checklist (before release)

✅ Register employer → verify appears in Supabase  
✅ Register worker → verify linked employer_no  
✅ Change punch policy → test from worker app  
✅ Clock-in/out → validate GPS stored  
✅ Create project → verify in DB  
✅ Delete project → ensure removed after SQL policy  
✅ Light/dark toggle → persists correctly  
✅ Logout → returns to login screen

---

## 📱 Running on Android (Mac)

If Android Studio emulator fails to connect:

### Option 1 – Expo Go on real Android phone
1. Install **Expo Go** from Play Store.  
2. Run `npx expo start` on your Mac.  
3. Scan the QR code with the Android device (same Wi-Fi).  
✅ Easiest and most reliable.

### Option 2 – Android Emulator
- Open AVD from Android Studio (API 33+).  
- In the Expo CLI window press:
  ```bash
  a
  ```
- If bundler not loading, run:
  ```bash
  adb reverse tcp:8081 tcp:8081
  ```
  or start Expo in tunnel mode:
  ```bash
  npx expo start --tunnel
  ```

---

## 📝 License

MIT © 2025 WorkLog Team
