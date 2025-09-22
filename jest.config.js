// jest.config.js
module.exports = {
    preset: 'jest-expo',
    testMatch: ['**/__tests__/**/*.test.ts?(x)'],
    transform: { '^.+\\.(ts|tsx)$': 'ts-jest' },
    transformIgnorePatterns: [
      'node_modules/(?!(jest-)?react-native|expo(nent)?|@expo(nent)?/.*|@react-native/.*)',
    ],
    setupFiles: ['<rootDir>/jest.setup.ts'],
    collectCoverageFrom: [
      'src/**/*.{ts,tsx}',
      '!src/**/__mocks__/**',
      '!src/**/supabase.ts', // if you don’t want to count this
    ],
  };