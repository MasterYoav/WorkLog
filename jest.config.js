// jest.config.js
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.ts?(x)', '**/__tests__/**/*.spec.ts?(x)'],
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|expo(nent)?|@expo(nent)?/.*|@react-native/.*)',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/__mocks__/**',
    '!src/**/supabase.ts',
  ],
  // 👇 זה הפתרון לשגיאה שלך
  moduleNameMapper: {
    '^expo/src/async-require/messageSocket$': '<rootDir>/__mocks__/expoMessageSocket.js',
  },
};