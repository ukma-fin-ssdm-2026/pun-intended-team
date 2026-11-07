// Written with the help of Claude
import { jest } from '@jest/globals';

// Reanimated, its worklets and the safe area need native modules that Jest does not have; each package ships a mock.
jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

// src/config.ts needs an API host; no test reaches it.
process.env.EXPO_PUBLIC_API_URL = 'http://localhost:4100';
