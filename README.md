# Arc

A lifestyle super-app for iOS and Android. Built with Expo and React Native, backed by Supabase. Tracks nutrition, fitness, finance, mood, and tasks in one place, with an AI assistant for logging via voice or photo.

This is the third iteration of a personal-tracking idea I've been building — first as a Next.js dashboard ([nutri-track](https://github.com/SayedKarimi/nutri-track)), then as a PWA ([lifeos](https://github.com/SayedKarimi/lifeos)), now as a real native app.

## Stack

- **Framework:** Expo SDK 54, React Native 0.81, React 19
- **Routing:** expo-router (file-based)
- **Backend:** Supabase (Postgres, Auth, Realtime)
- **State:** Zustand for auth, local state for everything else
- **Styling:** StyleSheet, custom design system, no UI library
- **Native APIs:** HealthKit (steps, sleep, heart), camera, push notifications, voice recognition, secure storage
- **Charts/UI:** react-native-svg for hand-rolled progress rings, react-native-reanimated

## Features

- Nutrition logging with macro rings, food search, barcode scan, photo analysis
- Finance tracking — transactions, goals, debts (sorted by APR), budgets, 12-month spend chart
- Workout sessions with tonnage tracking and weekly stats
- Tasks with priority + recurring schedules
- Journal, mood, fasting, weight history, progress photos
- AI chat + voice assistant (TTS via expo-speech, STT via @react-native-voice/voice)
- Offline cache with pending mutation queue
- HealthKit auto-sync (EAS build only)

## Status

Active development. Currently testing on iOS via EAS builds; App Store submission planned.
