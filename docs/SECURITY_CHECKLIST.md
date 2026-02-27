# WorkLog Security Checklist

## Implemented Baseline

- [x] **Secrets handling**
  - Supabase config comes from environment variables (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`).
  - Added `.env.example` and removed tracked `.env` from git.
- [x] **Network security**
  - Enforce HTTPS for Supabase URL at config/runtime.
  - Android cleartext traffic disabled (`usesCleartextTraffic: false`).
- [x] **Password handling**
  - Passwords are SHA-256 hashed before persistence for local and cloud auth flows.
  - Login supports legacy plaintext records and new hashed records.
- [x] **Input validation/sanitization**
  - Added centralized sanitization for text, numeric IDs, and emails.
  - Added basic validation for required fields and password length.
- [x] **Release hardening**
  - Enabled minification/resource shrinking/ProGuard for Android release via Expo build properties.
- [x] **CI release artifacts**
  - Added tag-triggered workflow that builds Android release APK and attaches it to GitHub Release.

## Ongoing Security TODOs

- [ ] Move authentication fully to Supabase Auth (server-managed password hashing + sessions) instead of custom `password_hash` handling.
- [ ] Add rate limiting and lockout policies to login endpoints (currently app-side only).
- [ ] Add stricter data validation at DB/RPC layer (RLS policies, constraints).
- [ ] Sign release artifacts with production keystore in CI secrets.
- [ ] Add dependency vulnerability scanning step (`npm audit`, SCA tool) in CI gate.
- [ ] Consider encrypted local-at-rest storage for sensitive profile fields, not only passwords.
