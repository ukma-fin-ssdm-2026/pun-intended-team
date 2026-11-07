// Written with the help of Claude
import { jest } from '@jest/globals';

// Reanimated and its worklets need native modules that Jest does not have; both packages ship mocks.
jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// src/config.ts needs an API host; no test reaches it.
process.env.EXPO_PUBLIC_API_URL = 'http://localhost:4100';
