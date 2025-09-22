// jest.setup.ts
import { config } from 'dotenv';

// Load test-local first
config({ path: '.env.test.local' });

// Fallbacks if keys still missing (useful on dev machines)
if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
  config(); // loads default .env if present
}

// Give network tests time
jest.setTimeout(30000);