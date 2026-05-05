// components/ArcIcon.tsx
// Monochrome icon system for Arc — replaces iOS emojis used across the app.
// Style: 1.75px strokes, rounded caps/joins, 24x24 viewBox. Matches Feather/Ionicons aesthetic.
//
// Usage:
//   import { ArcIcon } from '@/components/ArcIcon';
//   <ArcIcon name="flame" size={20} color="#FF6B35" />
//
// Dependency: react-native-svg (already in package.json via Expo SDK 54)

import React from 'react';
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';

export type ArcIconName =
  // Macros & nutrition
  | 'flame' | 'protein' | 'carbs' | 'fat' | 'fiber' | 'sugar' | 'sodium'
  | 'water' | 'steps' | 'sleep' | 'plate'
  // Log menu / actions
  | 'search' | 'bookmark' | 'camera' | 'edit' | 'plus' | 'x' | 'chevronRight'
  // Tasks
  | 'check' | 'checkSquare' | 'repeat'
  // Tabs & navigation
  | 'home' | 'activity' | 'workout' | 'progress' | 'plans' | 'dollar'
  | 'settings' | 'compass' | 'chatBubble' | 'mic'
  // Social & RPG
  | 'users' | 'swords' | 'book' | 'recap' | 'moneybag'
  // Finance categories
  | 'housing' | 'food' | 'transport' | 'health' | 'shopping'
  | 'entertainment' | 'subscriptions' | 'other'
  // Settings items
  | 'card' | 'target' | 'flag' | 'stopwatch' | 'barchart'
  | 'sun' | 'moon' | 'autoTheme' | 'refresh' | 'trash' | 'logout'
  // Celebration & stats
  | 'party' | 'scale' | 'timer' | 'bolt'
  // Extended set
  | 'trophy' | 'shield' | 'brain' | 'gem' | 'star' | 'heart'
  | 'briefcase' | 'lotus' | 'leg' | 'calendar' | 'sparkle' | 'rocket';

export type ArcIconProps = {
  name: ArcIconName;
  size?: number;
  color?: string;
};

const S = 1.75; // shared stroke width

export function ArcIcon({ name, size = 24, color = '#1C1C1E' }: ArcIconProps) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none' as const };
  const stroke = color;

  switch (name) {
    // ─── Macros & nutrition ────────────────────────────────────────
    case 'flame': return (
      <Svg {...common}>
        <Path d="M12 2c0 3-3 4.5-3 8a3 3 0 0 0 6 0c0-1-.5-2-1-2.5C15.5 9.5 18 12 18 15a6 6 0 0 1-12 0c0-5 6-7 6-13z" stroke={stroke} strokeWidth={S} strokeLinejoin="round"/>
      </Svg>
    );
    case 'protein': return (
      <Svg {...common}>
        <Path d="M4 10v4M7 7v10M20 10v4M17 7v10M7 12h10" stroke={stroke} strokeWidth={S} strokeLinecap="round"/>
      </Svg>
    );
    case 'carbs': return (
      <Svg {...common}>
        <Path d="M12 3v18" stroke={stroke} strokeWidth={S} strokeLinecap="round"/>
        <Path d="M12 7c-2-1.5-4-1-4-1s0 2 2 3.5C12 11 12 9 12 7zM12 7c2-1.5 4-1 4-1s0 2-2 3.5C12 11 12 9 12 7zM12 12c-2-1.5-4-1-4-1s0 2 2 3.5C12 16 12 14 12 12zM12 12c2-1.5 4-1 4-1s0 2-2 3.5C12 16 12 14 12 12zM12 17c-2-1.5-4-1-4-1s0 2 2 3.5C12 21 12 19 12 17zM12 17c2-1.5 4-1 4-1s0 2-2 3.5C12 21 12 19 12 17z" stroke={stroke} strokeWidth={S} strokeLinejoin="round"/>
      </Svg>
    );
    case 'fat': return (
      <Svg {...common}>
        <Path d="M12 2.5s-6.5 7-6.5 11.5a6.5 6.5 0 0 0 13 0C18.5 9.5 12 2.5 12 2.5z" stroke={stroke} strokeWidth={S} strokeLinejoin="round"/>
      </Svg>
    );
    case 'fiber': return (
      <Svg {...common}>
        <Circle cx={9} cy={10} r={3} stroke={stroke} strokeWidth={S}/>
        <Circle cx={15} cy={10} r={3} stroke={stroke} strokeWidth={S}/>
        <Circle cx={12} cy={15} r={3} stroke={stroke} strokeWidth={S}/>
      </Svg>
    );
    case 'sugar': return (
      <Svg {...common}>
        <Path d="M12 4l7 4v8l-7 4-7-4V8l7-4z" stroke={stroke} strokeWidth={S} strokeLinejoin="round"/>
        <Path d="M5 8l7 4 7-4M12 12v8" stroke={stroke} strokeWidth={S} strokeLinejoin="round"/>
      </Svg>
    );
    case 'sodium': return (
      <Svg {...common}>
        <Path d="M7 9h10l-1 11a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1L7 9z" stroke={stroke} strokeWidth={S} strokeLinejoin="round"/>
        <Path d="M9 9V5a3 3 0 0 1 6 0v4" stroke={stroke} strokeWidth={S}/>
        <Circle cx={11} cy={13} r={0.6} fill={stroke}/>
        <Circle cx={13.5} cy={12} r={0.6} fill={stroke}/>
        <Circle cx={12.5} cy={15} r={0.6} fill={stroke}/>
      </Svg>
    );
    case 'water': return (
      <Svg {...common}>
        <Path d="M6 7h11l-1 13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 7z" stroke={stroke} strokeWidth={S} strokeLinejoin="round"/>
        <Path d="M17 10h2a2 2 0 0 1 0 4h-2" stroke={stroke} strokeWidth={S}/>
      </Svg>
    );
    case 'steps': return (
      <Svg {...common}>
        <Path d="M3 15c0-3 2-4 4-4l3-3 6 1 5 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke={stroke} strokeWidth={S} strokeLinejoin="round"/>
        <Path d="M7 15h14M10 11l2 2" stroke={stroke} strokeWidth={S} strokeLinecap="round"/>
      </Svg>
    );
    case 'sleep':
    case 'moon': return (
      <Svg {...common}>
        <Path d="M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z" stroke={stroke} strokeWidth={S} strokeLinejoin="round"/>
      </Svg>
    );
    case 'plate': return (
      <Svg {...common}>
        <Circle cx={12} cy={12} r={7} stroke={stroke} strokeWidth={S}/>
        <Circle cx={12} cy={12} r={3.5} stroke={stroke} strokeWidth={S}/>
      </Svg>
    );

    // ─── Log menu / actions ────────────────────────────────────────
    case 'search': return (
      <Svg {...common}>
        <Circle cx={11} cy={11} r={6} stroke={stroke} strokeWidth={S}/>
        <Path d="M20 20l-4-4" stroke={stroke} strokeWidth={S} strokeLinecap="round"/>
      </Svg>
    );
    case 'bookmark': return (
      <Svg {...common}>
        <Path d="M6 4h12v17l-6-4-6 4V4z" stroke={stroke} strokeWidth={S} strokeLinejoin="round"/>
      </Svg>
    );
    case 'camera': return (
      <Svg {...common}>
        <Path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" stroke={stroke} strokeWidth={S} strokeLinejoin="round"/>
        <Circle cx={12} cy={13} r={3.5} stroke={stroke} strokeWidth={S}/>
      </Svg>
    );
    case 'edit': return (
      <Svg {...common}>
        <Path d="M4 20h4L19 9l-4-4L4 16v4z" stroke={stroke} strokeWidth={S} strokeLinejoin="round"/>
        <Path d="M14 6l4 4" stroke={stroke} strokeWidth={S}/>
      </Svg>
    );
    case 'plus': return (
      <Svg {...common}>
        <Path d="M12 5v14M5 12h14" stroke={stroke} strokeWidth={2} strokeLinecap="round"/>
      </Svg>
    );
    case 'x': return (
      <Svg {...common}>
        <Path d="M6 6l12 12M18 6L6 18" stroke={stroke} strokeWidth={2} strokeLinecap="round"/>
      </Svg>
    );
    case 'chevronRight': return (
      <Svg {...common}>
        <Path d="M9 6l6 6-6 6" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    );

    // ─── Tasks ─────────────────────────────────────────────────────
    case 'check': return (
      <Svg {...common}>
        <Rect x={4} y={4} width={16} height={16} rx={4} stroke={stroke} strokeWidth={S}/>
        <Path d="M8 12l3 3 5-6" stroke={stroke} strokeWidth={S} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    );
    case 'checkSquare': return (
      <Svg {...common}>
        <Rect x={4} y={4} width={16} height={16} rx={3} stroke={stroke} strokeWidth={S}/>
        <Path d="M8 12l3 3 5-6" stroke={stroke} strokeWidth={S} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    );
    case 'repeat': return (
      <Svg {...common}>
        <Path d="M4 12a6 6 0 0 1 10-4.5L17 10M20 12a6 6 0 0 1-10 4.5L7 14" stroke={stroke} strokeWidth={S} strokeLinecap="round" strokeLinejoin="round"/>
        <Path d="M17 6v4h-4M7 18v-4h4" stroke={stroke} strokeWidth={S} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    );

    // ─── Tabs & navigation ─────────────────────────────────────────
    case 'home':
    case 'housing': return (
      <Svg {...common}>
        <Path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9z" stroke={stroke} strokeWidth={S} strokeLinejoin="round"/>
      </Svg>
    );
    case 'activity': return (
      <Svg {...common}>
        <Path d="M3 12h3l3-8 4 16 3-8h5" stroke={stroke} strokeWidth={S} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    );
    case 'workout': return (
      <Svg {...common}>
        <Path d="M2 10v4M5 7v10M19 10v4M22 7v10M5 12h14" stroke={stroke} strokeWidth={S} strokeLinecap="round"/>
      </Svg>
    );
    case 'progress':
    case 'barchart': return (
      <Svg {...common}>
        <Path d="M5 20V10M12 20V4M19 20v-7" stroke={stroke} strokeWidth={S} strokeLinecap="round"/>
        <Path d="M3 20h18" stroke={stroke} strokeWidth={S} strokeLinecap="round"/>
      </Svg>
    );
    case 'plans': return (
      <Svg {...common}>
        <Path d="M5 6h14M5 12h14M5 18h14" stroke={stroke} strokeWidth={S} strokeLinecap="round"/>
        <Circle cx={5} cy={6} r={0.5} fill={stroke}/>
        <Circle cx={5} cy={12} r={0.5} fill={stroke}/>
        <Circle cx={5} cy={18} r={0.5} fill={stroke}/>
      </Svg>
    );
    case 'dollar': return (
      <Svg {...common}>
        <Path d="M12 3v18M16 7.5c0-1.5-2-2.5-4-2.5s-4 1-4 2.5S10 10 12 10s4 1 4 2.5S14 15 12 15s-4-1-4-2.5" stroke={stroke} strokeWidth={S} strokeLinecap="round"/>
      </Svg>
    );
    case 'settings': return (
      <Svg {...common}>
        <Circle cx={12} cy={12} r={3} stroke={stroke} strokeWidth={S}/>
        <Path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" stroke={stroke} strokeWidth={S} strokeLinejoin="round"/>
      </Svg>
    );
    case 'compass': return (
      <Svg {...common}>
        <Circle cx={12} cy={12} r={9} stroke={stroke} strokeWidth={S}/>
        <Path d="M16 8l-2 6-6 2 2-6 6-2z" stroke={stroke} strokeWidth={S} strokeLinejoin="round"/>
      </Svg>
    );
    case 'chatBubble': return (
      <Svg {...common}>
        <Path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-8l-4 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" stroke={stroke} strokeWidth={S} strokeLinejoin="round"/>
      </Svg>
    );
    case 'mic': return (
      <Svg {...common}>
        <Rect x={9} y={3} width={6} height={12} rx={3} stroke={stroke} strokeWidth={S}/>
        <Path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke={stroke} strokeWidth={S} strokeLinecap="round"/>
      </Svg>
    );

    // ─── Social & RPG ──────────────────────────────────────────────
    case 'users': return (
      <Svg {...common}>
        <Circle cx={9} cy={8} r={3.5} stroke={stroke} strokeWidth={S}/>
        <Circle cx={17} cy={9} r={2.5} stroke={stroke} strokeWidth={S}/>
        <Path d="M3 19a6 6 0 0 1 12 0M15 19a5 5 0 0 1 6 0" stroke={stroke} strokeWidth={S} strokeLinecap="round"/>
      </Svg>
    );
    case 'swords': return (
      <Svg {...common}>
        <Path d="M3 3l7 7-3 3-4-4V3zM21 3l-7 7 3 3 4-4V3zM10 10l4 4-7 7H3v-4l7-7z" stroke={stroke} strokeWidth={S} strokeLinejoin="round"/>
      </Svg>
    );
    case 'book': return (
      <Svg {...common}>
        <Path d="M5 4h13a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1" stroke={stroke} strokeWidth={S} strokeLinejoin="round"/>
        <Path d="M9 4v13l2-1.5 2 1.5V4" stroke={stroke} strokeWidth={S} strokeLinejoin="round"/>
      </Svg>
    );
    case 'recap': return (
      <Svg {...common}>
        <Path d="M5 20V13M10 20V7M15 20v-9M20 20V4" stroke={stroke} strokeWidth={S} strokeLinecap="round"/>
      </Svg>
    );
    case 'moneybag': return (
      <Svg {...common}>
        <Path d="M9 4h6l1 3H8l1-3zM8 7h8l3 4a7 7 0 1 1-14 0l3-4z" stroke={stroke} strokeWidth={S} strokeLinejoin="round"/>
        <Path d="M12 11v7M14 13c0-1-1-1.5-2-1.5s-2 .5-2 1.5 4 1 4 2-1 1.5-2 1.5-2-.5-2-1.5" stroke={stroke} strokeWidth={S} strokeLinecap="round"/>
      </Svg>
    );

    // ─── Finance categories ────────────────────────────────────────
    case 'food': return (
      <Svg {...common}>
        <Path d="M4 9a8 8 0 0 1 16 0H4zM3 13h18M4 17h16" stroke={stroke} strokeWidth={S} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    );
    case 'transport': return (
      <Svg {...common}>
        <Path d="M5 16v-4l2-5h10l2 5v4M3 16h18v3h-3v-2H6v2H3v-3z" stroke={stroke} strokeWidth={S} strokeLinejoin="round"/>
        <Circle cx={7.5} cy={17} r={1} fill={stroke}/>
        <Circle cx={16.5} cy={17} r={1} fill={stroke}/>
      </Svg>
    );
    case 'health': return (
      <Svg {...common}>
        <G transform="rotate(-35 12 12)">
          <Rect x={2} y={9} width={20} height={6} rx={3} stroke={stroke} strokeWidth={S}/>
        </G>
        <Path d="M8.5 8.5l5 5" stroke={stroke} strokeWidth={S} strokeLinecap="round"/>
      </Svg>
    );
    case 'shopping': return (
      <Svg {...common}>
        <Path d="M5 8h14l-1 12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 8z" stroke={stroke} strokeWidth={S} strokeLinejoin="round"/>
        <Path d="M9 8V6a3 3 0 0 1 6 0v2" stroke={stroke} strokeWidth={S}/>
      </Svg>
    );
    case 'entertainment': return (
      <Svg {...common}>
        <Rect x={3} y={9} width={18} height={12} rx={1} stroke={stroke} strokeWidth={S}/>
        <Path d="M3 9l2-4 3 1-2 4M8 6l3 1-2 4-3-1M13 7l3 1-2 4-3-1M18 8l3 1-2 4-3-1" stroke={stroke} strokeWidth={S} strokeLinejoin="round"/>
      </Svg>
    );
    case 'subscriptions': return (
      <Svg {...common}>
        <Rect x={6} y={2} width={12} height={20} rx={2.5} stroke={stroke} strokeWidth={S}/>
        <Path d="M10 18h4" stroke={stroke} strokeWidth={S} strokeLinecap="round"/>
      </Svg>
    );
    case 'other': return (
      <Svg {...common}>
        <Path d="M12 4v16M4 12h16M6.3 6.3l11.4 11.4M17.7 6.3L6.3 17.7" stroke={stroke} strokeWidth={S} strokeLinecap="round"/>
      </Svg>
    );

    // ─── Settings items ────────────────────────────────────────────
    case 'card': return (
      <Svg {...common}>
        <Rect x={3} y={5} width={18} height={14} rx={2} stroke={stroke} strokeWidth={S}/>
        <Path d="M3 10h18M7 15h4" stroke={stroke} strokeWidth={S} strokeLinecap="round"/>
      </Svg>
    );
    case 'target': return (
      <Svg {...common}>
        <Circle cx={12} cy={12} r={8} stroke={stroke} strokeWidth={S}/>
        <Circle cx={12} cy={12} r={4} stroke={stroke} strokeWidth={S}/>
        <Circle cx={12} cy={12} r={1} fill={stroke}/>
      </Svg>
    );
    case 'flag': return (
      <Svg {...common}>
        <Path d="M5 3v18M5 4h12l-2 4 2 4H5" stroke={stroke} strokeWidth={S} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    );
    case 'stopwatch': return (
      <Svg {...common}>
        <Circle cx={12} cy={14} r={8} stroke={stroke} strokeWidth={S}/>
        <Path d="M12 14V9M9 3h6M12 3v3M19 7l1-1" stroke={stroke} strokeWidth={S} strokeLinecap="round"/>
      </Svg>
    );
    case 'sun': return (
      <Svg {...common}>
        <Circle cx={12} cy={12} r={4} stroke={stroke} strokeWidth={S}/>
        <Path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" stroke={stroke} strokeWidth={S} strokeLinecap="round"/>
      </Svg>
    );
    case 'autoTheme': return (
      <Svg {...common}>
        <Circle cx={12} cy={12} r={8.5} stroke={stroke} strokeWidth={S}/>
        <Path d="M12 3.5v17a8.5 8.5 0 0 0 0-17z" fill={stroke}/>
      </Svg>
    );
    case 'refresh': return (
      <Svg {...common}>
        <Path d="M4 12a8 8 0 0 1 13.5-5.8L20 8M20 12a8 8 0 0 1-13.5 5.8L4 16" stroke={stroke} strokeWidth={S} strokeLinecap="round" strokeLinejoin="round"/>
        <Path d="M20 3v5h-5M4 21v-5h5" stroke={stroke} strokeWidth={S} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    );
    case 'trash': return (
      <Svg {...common}>
        <Path d="M4 7h16M10 4h4a1 1 0 0 1 1 1v2H9V5a1 1 0 0 1 1-1zM6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M10 11v7M14 11v7" stroke={stroke} strokeWidth={S} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    );
    case 'logout': return (
      <Svg {...common}>
        <Path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l4 4-4 4M9 12h10" stroke={stroke} strokeWidth={S} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    );

    // ─── Celebration & stats ───────────────────────────────────────
    case 'party': return (
      <Svg {...common}>
        <Path d="M5 19l4-12 8 8-12 4z" stroke={stroke} strokeWidth={S} strokeLinejoin="round"/>
        <Path d="M14 3l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2zM20 10l.6 1.4 1.4.6-1.4.6L20 14l-.6-1.4L18 12l1.4-.6L20 10z" stroke={stroke} strokeWidth={S} strokeLinejoin="round"/>
      </Svg>
    );
    case 'scale': return (
      <Svg {...common}>
        <Path d="M12 4v16M6 20h12" stroke={stroke} strokeWidth={S} strokeLinecap="round"/>
        <Path d="M3 10l3-6 3 6a3 3 0 1 1-6 0zM15 10l3-6 3 6a3 3 0 1 1-6 0z" stroke={stroke} strokeWidth={S} strokeLinejoin="round"/>
      </Svg>
    );
    case 'timer': return (
      <Svg {...common}>
        <Circle cx={12} cy={13} r={8} stroke={stroke} strokeWidth={S}/>
        <Path d="M12 13V8M9 3h6" stroke={stroke} strokeWidth={S} strokeLinecap="round"/>
      </Svg>
    );
    case 'bolt': return (
      <Svg {...common}>
        <Path d="M13 3L5 14h6l-1 7 8-11h-6l1-7z" stroke={stroke} strokeWidth={S} strokeLinejoin="round"/>
      </Svg>
    );

    // ─── Extended set ──────────────────────────────────────────────
    case 'trophy': return (
      <Svg {...common}>
        <Path d="M6 4h12v4a6 6 0 0 1-12 0V4zM6 6H4a2 2 0 0 0 0 4h2M18 6h2a2 2 0 0 1 0 4h-2M9 14l-1 6h8l-1-6M8 20h8" stroke={stroke} strokeWidth={S} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    );
    case 'shield': return (
      <Svg {...common}>
        <Path d="M12 3l8 4v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V7l8-4z" stroke={stroke} strokeWidth={S} strokeLinejoin="round"/>
      </Svg>
    );
    case 'brain': return (
      <Svg {...common}>
        <Path d="M12 4a4 4 0 0 0-4 4c0 1 .4 2 1 2.5A3.5 3.5 0 0 0 6 14a3.5 3.5 0 0 0 3.5 3.5H12M12 4a4 4 0 0 1 4 4c0 1-.4 2-1 2.5A3.5 3.5 0 0 1 18 14a3.5 3.5 0 0 1-3.5 3.5H12M12 4v13.5M12 20v-2.5" stroke={stroke} strokeWidth={S} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    );
    case 'gem': return (
      <Svg {...common}>
        <Path d="M6 4h12l4 6-10 11L2 10l4-6zM2 10h20M12 21l3-11M12 21L9 10M6 4l3 6M18 4l-3 6" stroke={stroke} strokeWidth={S} strokeLinejoin="round"/>
      </Svg>
    );
    case 'star': return (
      <Svg {...common}>
        <Path d="M12 3l2.5 5.5L20 9.5l-4 4 1 5.5L12 16.5 7 19l1-5.5-4-4 5.5-1L12 3z" stroke={stroke} strokeWidth={S} strokeLinejoin="round"/>
      </Svg>
    );
    case 'heart': return (
      <Svg {...common}>
        <Path d="M12 6C10 3 5 3 4 7s3 8 8 13c5-5 9-9 8-13s-6-4-8-1z" stroke={stroke} strokeWidth={S} strokeLinejoin="round"/>
      </Svg>
    );
    case 'briefcase': return (
      <Svg {...common}>
        <Rect x={3} y={8} width={18} height={12} rx={2} stroke={stroke} strokeWidth={S}/>
        <Path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 14h18" stroke={stroke} strokeWidth={S} strokeLinecap="round"/>
      </Svg>
    );
    case 'lotus': return (
      <Svg {...common}>
        <Path d="M12 20c-4-3-7-7-7-11a7 7 0 0 1 7-5 7 7 0 0 1 7 5c0 4-3 8-7 11z" stroke={stroke} strokeWidth={S} strokeLinejoin="round"/>
        <Path d="M12 20c-2-2-3-5-3-8M12 20c2-2 3-5 3-8" stroke={stroke} strokeWidth={S} strokeLinecap="round"/>
      </Svg>
    );
    case 'leg': return (
      <Svg {...common}>
        <Path d="M12 4v8l-2 4v4M12 12l2 4v4M10 20h4M14 20h-4" stroke={stroke} strokeWidth={S} strokeLinecap="round" strokeLinejoin="round"/>
        <Circle cx={12} cy={4} r={2} stroke={stroke} strokeWidth={S}/>
      </Svg>
    );
    case 'calendar': return (
      <Svg {...common}>
        <Rect x={4} y={5} width={16} height={16} rx={2} stroke={stroke} strokeWidth={S}/>
        <Path d="M8 3v4M16 3v4M4 11h16" stroke={stroke} strokeWidth={S} strokeLinecap="round"/>
      </Svg>
    );
    case 'sparkle': return (
      <Svg {...common}>
        <Path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3zM18 14l.7 2.3L21 17l-2.3.7L18 20l-.7-2.3L15 17l2.3-.7L18 14z" stroke={stroke} strokeWidth={S} strokeLinejoin="round"/>
      </Svg>
    );
    case 'rocket': return (
      <Svg {...common}>
        <Path d="M12 4c0 0-6 4-6 12h12c0-8-6-12-6-12zM9 16l-2 4M15 16l2 4M10 12h4" stroke={stroke} strokeWidth={S} strokeLinecap="round" strokeLinejoin="round"/>
      </Svg>
    );

    default: return null;
  }
}

export default ArcIcon;
