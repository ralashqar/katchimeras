import { useEffect } from 'react';
import * as Linking from 'expo-linking';

import { homeRepository } from '@/storage/repositories/home-repository';
import { bootstrapStreakSystem, flushStreakOutbox, pullStreakSnapshot, trackStreakEvent } from '@/utils/streak-sync';
import { supabase } from '@/utils/supabase';
import { streakRepository } from '@/storage/repositories/streak-repository';
import { syncStreakReminder } from '@/utils/streak-notification';

export function StreakBootstrap() {
  useEffect(() => {
    let notificationSubscription: { remove: () => void } | null = null;
    const handleAuthUrl = async (url: string) => {
      const parsed = Linking.parse(url);
      const code = typeof parsed.queryParams?.code === 'string' ? parsed.queryParams.code : null;
      const accessToken = typeof parsed.queryParams?.access_token === 'string' ? parsed.queryParams.access_token : null;
      const refreshToken = typeof parsed.queryParams?.refresh_token === 'string' ? parsed.queryParams.refresh_token : null;
      if (code) await supabase.auth.exchangeCodeForSession(code);
      else if (accessToken && refreshToken) await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    };
    void bootstrapStreakSystem(homeRepository.load());
    void Linking.getInitialURL().then((url) => url ? handleAuthUrl(url) : undefined);
    void syncStreakReminder(streakRepository.snapshot());
    const unsubscribeStreak = streakRepository.subscribe(() => {
      void syncStreakReminder(streakRepository.snapshot());
    });
    const urlListener = Linking.addEventListener('url', ({ url }) => { void handleAuthUrl(url); });
    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      void flushStreakOutbox().then(() => pullStreakSnapshot());
    });
    if (process.env.EXPO_OS !== 'web') {
      void import('expo-notifications').then((Notifications) => {
        notificationSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
          if (response.notification.request.content.data?.kind === 'streak_reminder') {
            void trackStreakEvent('streak_notification_opened');
          }
        });
      }).catch(() => {});
    }
    return () => {
      unsubscribeStreak();
      authListener.subscription.unsubscribe();
      urlListener.remove();
      notificationSubscription?.remove();
    };
  }, []);
  return null;
}
