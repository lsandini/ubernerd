import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { initDb } from '../src/db';
import {
  addNotificationResponseListener,
  getLastNotificationResponse,
} from '../src/notifications';

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    initDb();

    // Notification tap listener (warm start)
    const cleanup = addNotificationResponseListener((dropId) => {
      router.push(`/drop?dropId=${dropId}`);
    });

    // Cold-start: check if opened via notification
    getLastNotificationResponse().then((dropId) => {
      if (dropId) {
        router.push(`/drop?dropId=${dropId}`);
      }
    });

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  return (
    <>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#1a1a2e' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: '#0f0f23' },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Quiz Gauntlet' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="ladder" options={{ title: 'Ladder' }} />
        <Stack.Screen
          name="question/[id]"
          options={{ title: 'Question', headerShown: false, gestureEnabled: false }}
        />
        <Stack.Screen
          name="drop"
          options={{ title: 'Drop', headerShown: false, gestureEnabled: false }}
        />
      </Stack>
      <StatusBar style="light" />
    </>
  );
}
