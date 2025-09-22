![WorkLog Logo](./assets/logo.png)

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
```

- Local dev: `.env.test.local`  
- CI: GitHub Actions secrets → EAS env variables  
- **Never commit real keys** 🚫

---

## 🧪 Testing

Run coverage tests:

```bash
npm run test:cov
```

- Integration tests run against a **Supabase CI database**  
- Local media tests run against Expo FileSystem sandbox  
- Coverage currently ~80%+

---

## 📂 Project Structure

```
WorkLog-mobile/
├── app/                # Screens (expo-router)
│   ├── _layout.tsx
│   ├── auth.tsx
│   ├── employer-home.tsx
│   ├── employer-project.tsx
│   └── worker-home.tsx
├── components/         # Shared UI components
│   └── WLLogo.tsx
├── src/
│   ├── data/
│   │   └── repo.ts     # Supabase + offline repo logic
│   ├── lib/
│   │   ├── storage.ts  # Local-only data
│   │   ├── location.ts # GPS + geocode helpers
│   │   └── supabase.ts # Supabase client
├── __tests__/          # Jest tests
├── assets/
│   └── logo.png
├── .env.test.local     # Local test env
└── README.md
```

---

## 🚀 Running Locally

1. Install deps  
   ```bash
   npm install
   ```

2. Set up environment  
   ```bash
   cp .env.test.local .env
   ```

3. Start dev server  
   ```bash
   npx expo start
   ```

4. Run tests  
   ```bash
   npm run test:cov
   ```

---

## 📦 Building (EAS)

Make sure you have an Expo account and EAS CLI:

```bash
eas build --platform ios
eas build --platform android
```

Secrets are managed in Expo → Project → Secrets.

---

## ✅ Recent Changes

- Added **WLLogo** reusable component → logo now **larger across the app**  
- Enforced **unique employer & worker IDs** (no duplicates)  
- Fixed **Supabase CI schema setup** for tests  
- Improved **offline queue sync** logic  
- Strengthened **dark mode UI** consistency  

---

## 📝 License

MIT
