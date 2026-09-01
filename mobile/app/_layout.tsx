import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ConnectionConfigContext, useConnectionConfigState } from '../src/storage/connectionConfig';
import { RecommenderConfigContext, useRecommenderConfigState } from '../src/storage/recommenderConfig';
import { useColors } from '../src/theme/colors';

export default function RootLayout() {
  const connectionConfigState = useConnectionConfigState();
  const recommenderConfigState = useRecommenderConfigState(connectionConfigState.config?.baseUrl);
  const colors = useColors();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ConnectionConfigContext.Provider value={connectionConfigState}>
          <RecommenderConfigContext.Provider value={recommenderConfigState}>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShadowVisible: false,
                headerStyle: { backgroundColor: colors.surface },
                headerTintColor: colors.accent,
                headerTitleStyle: { color: colors.text },
                contentStyle: { backgroundColor: colors.background },
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="browse" options={{ title: 'Browse Catalog' }} />
              <Stack.Screen
                name="settings"
                options={{ presentation: 'modal', title: 'Connection Settings' }}
              />
            </Stack>
          </RecommenderConfigContext.Provider>
        </ConnectionConfigContext.Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
