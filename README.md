# WorkLog Mobile

📱 Cross-platform mobile app (React Native + Expo) for employers and workers to track work hours, projects, and attendance.  
Backend powered by **Supabase**.  
Supports **offline mode**, **local storage with AsyncStorage**, and **media saved locally in the app sandbox**.

---

## ✨ Features

- **Employer & Worker accounts**
  - Secure login & password management  
  - Unique IDs per user (no duplicate employers/workers allowed) ✅

- **Attendance clock**
  - Punch **in/out** with real GPS validation (haversine distance check, accuracy filter)  
  - Shift duration tracking in real time  
  - Offline punches are queued and synced later

- **Projects**
  - Employers can create and manage projects  
  - Projects stored in Supabase (with local fallback)  
  - Media (photos, videos, files) saved locally per project

- **Workers**
  - Employers can see all workers and their total hours  
  - Sorted by seniority

- **Personal totals**
  - Monthly summary per employer  
  - Worker total hours across all time

- **Dark mode support**
  - Auto-adapted using `useColorScheme`  
  - Panels and text styled for light/dark themes

- **Bigger app logo**
  - Central reusable component `WLLogo` in `components/`  
  - Easy to resize globally or per screen

---

## 🏗️ Tech Stack

- [Expo](https://expo.dev) (React Native runtime)
- [expo-router](https://expo.github.io/router/docs)
- [Supabase](https://supabase.com) (Postgres + auth + API)
- AsyncStorage for offline/local data
- Jest + jest-expo for testing
- TypeScript for type safety

---

## 🔑 Environment Variables

All secrets are **kept outside the repo**.  
Create `.env` files (or use EAS Secrets in CI/CD):

```env
EXPO_PUBLIC_SUPABASE_URL="https://xxxx.supabase.co"
EXPO_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"

# For CI tests only (not bundled into the app)
SUPABASE_SERVICE_ROLE_KEY="service-role-key"