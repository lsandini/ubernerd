import { Platform } from 'react-native';

const UUID_KEY = 'ug_uuid';

/** UUID v4 generator that works on all RN runtimes (Hermes, JSC, web). */
function uuidv4(): string {
  // Use crypto.randomUUID if available (web, newer runtimes)
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: manual UUID v4 via Math.random
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Get or create the device UUID. Always returns a valid UUID string. */
export async function getOrCreateUuid(): Promise<string> {
  if (Platform.OS === 'web') {
    let id = localStorage.getItem(UUID_KEY);
    if (!id) {
      id = uuidv4();
      localStorage.setItem(UUID_KEY, id);
    }
    return id;
  }

  const SecureStore = require('expo-secure-store') as typeof import('expo-secure-store');
  let id = await SecureStore.getItemAsync(UUID_KEY);
  if (!id) {
    id = uuidv4();
    await SecureStore.setItemAsync(UUID_KEY, id);
  }
  return id;
}

/** Reset the UUID (returns the new one). */
export async function resetUuid(): Promise<string> {
  const id = uuidv4();
  if (Platform.OS === 'web') {
    localStorage.setItem(UUID_KEY, id);
  } else {
    const SecureStore = require('expo-secure-store') as typeof import('expo-secure-store');
    await SecureStore.setItemAsync(UUID_KEY, id);
  }
  return id;
}
