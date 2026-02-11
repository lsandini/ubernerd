import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { initDb } from '../src/db';

export default function RootLayout() {
  useEffect(() => {
    initDb();
  }, []);

  return (
    <>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#1a1a2e' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '600' },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Quiz Gauntlet' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="ladder" options={{ title: 'Ladder' }} />
        <Stack.Screen
          name="question/[id]"
          options={{ title: 'Question', headerShown: false }}
        />
      </Stack>
      <StatusBar style="light" />
    </>
  );
}
