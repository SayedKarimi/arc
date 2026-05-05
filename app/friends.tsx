import { useEffect, useState, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput,
  StyleSheet, RefreshControl, Alert, ActivityIndicator, Share,

} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { format, subDays } from "date-fns";
import { supabase } from "@/lib/supabase/client";
import { apiUrl } from "@/lib/api";
import { ArcIcon, ArcIconName } from "@/components/ArcIcon";

const BG = "#F2F2F7";
const DARK = "#1C1C1E";
const SURFACE = "#FFFFFF";
const BORDER = "#E5E5EA";
const SUBTITLE = "#8E8E93";
const TEXT3 = "#C7C7CC";
const INDIGO = "#6366f1";
const BASE_URL = "https://lifeos-iota-wine.vercel.app";

interface Profile { id: string; username: string; }
interface Friendship { id: string; requester_id: string; addressee_id: string; status: string; otherUser: Profile; }
interface Badge { emoji: string; label: string; }
interface RingData { nutrition: number; hydration: number; steps: number; sleep: number; workout: number; }
interface LeaderboardEntry { username: string; score: number; userId: string; badges: Badge[]; rings: RingData; }
interface Challenge { id: string; creator_id: string; title: string; type: string; goal: number; start_date: string; end_date: string; participants: string[]; progress: Record<string, number>; creatorName: string; }
type Period = "today" | "week" | "month";
type Tab = "leaderboard" | "friends" | "challenges" | "feed" | "add";

function ActivityRingsView({ rings, size = 36 }: { rings: RingData; size?: number }) {
  const domains = [
    { color: "#f97316", pct: rings.nutrition },
    { color: "#3b82f6", pct: rings.hydration },
    { color: "#22c55e", pct: rings.steps },
    { color: "#a78bfa", pct: rings.sleep },
    { color: "#f43f5e", pct: rings.workout },
  ];
  const trackW = size * 0.065;
  const gap = size * 0.01;
  const outerR = (size / 2) - trackW / 2 - 1;

  return (
    <View style={{ width: size, height: size, position: "relative" }}>
      {domains.map((d, i) => {
        const r = outerR - i * (trackW + gap);
        const circumference = 2 * Math.PI * r;
        const pct = Math.min(d.pct / 100, 1);
        return (
          <View key={i} style={{ position: "absolute", top: size / 2 - r - trackW / 2, left: size / 2 - r - trackW / 2, width: (r + trackW / 2) * 2, height: (r + trackW / 2) * 2 }}>
            <View style={{ width: "100%", height: "100%", borderRadius: r + trackW / 2, borderWidth: trackW, borderColor: d.color + "26" }} />
            {pct > 0 && (
              <View style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", borderRadius: r + trackW / 2, borderWidth: trackW, borderColor: "transparent", borderTopColor: d.color, borderRightColor: pct > 0.25 ? d.color : "transparent", borderBottomColor: pct > 0.5 ? d.color : "transparent", borderLeftColor: pct > 0.75 ? d.color : "transparent", transform: [{ rotate: "-90deg" }] }} />
            )}
          </View>
        );
      })}
    </View>
  );
}

export default function FriendsScreen() {
  const router = useRouter();
  const [myId, setMyId] = useState("");
  const [myUsername, setMyUsername] = useState("");
  const [tab, setTab] = useState<Tab>("leaderboard");
  const [period, setPeriod] = useState<Period>("today");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [pending, setPending] = useState<Friendship[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [feedItems, setFeedItems] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [requestSent, setRequestSent] = useState<string[]>([]);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [showCreateChallenge, setShowCreateChallenge] = useState(false);
  const [challengeForm, setChallengeForm] = useState({ title: "", type: "steps", goal: "", days: "7" });
  const [challengeLoading, setChallengeLoading] = useState(false);
  const [invitedFriends, setInvitedFriends] = useState<string[]>([]);
  const [chatFriend, setChatFriend] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [msgInput, setMsgInput] = useState("");
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const scrollRef = useRef<ScrollView>(null);

  const loadAll = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMyId(user.id);

    const { data: sent } = await supabase.from("friendships").select("*").eq("requester_id", user.id);
    const { data: received } = await supabase.from("friendships").select("*").eq("addressee_id", user.id);
    const allFriendships = [...(sent || []), ...(received || [])];
    const otherIds = allFriendships.map(f => f.requester_id === user.id ? f.addressee_id : f.requester_id);

    let profileMap: Record<string, Profile> = {};
    if (otherIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id,username").in("id", otherIds);
      (profiles || []).forEach(p => { profileMap[p.id] = p; });
    }

    const { data: myProfile } = await supabase.from("profiles").select("username").eq("id", user.id).single();
    setMyUsername(myProfile?.username || "You");

    const withProfiles = allFriendships.map(f => ({
      ...f,
      otherUser: profileMap[f.requester_id === user.id ? f.addressee_id : f.requester_id] || { id: "", username: "Unknown" },
    }));

    const acceptedFriends = withProfiles.filter(f => f.status === "accepted");
    const pendingIncoming = withProfiles.filter(f => f.status === "pending" && f.addressee_id === user.id);
    setFriends(acceptedFriends);
    setPending(pendingIncoming);

    // Load leaderboard
    const friendIds = acceptedFriends.map(f => f.requester_id === user.id ? f.addressee_id : f.requester_id);
    const allIds = [...friendIds, user.id];
    const today = format(new Date(), "yyyy-MM-dd");
    const weekAgo = format(subDays(new Date(), 6), "yyyy-MM-dd");
    const since = period === "today" ? today : period === "week" ? weekAgo : format(subDays(new Date(), 29), "yyyy-MM-dd");

    const { data: scores } = await supabase.from("momentum_snapshots").select("user_id,score,date").in("user_id", allIds).gte("date", since);
    const scoresByUser: Record<string, number[]> = {};
    (scores || []).forEach(s => { if (!scoresByUser[s.user_id]) scoresByUser[s.user_id] = []; scoresByUser[s.user_id].push(s.score); });

    const entries: LeaderboardEntry[] = allIds.map(id => {
      const userScores = scoresByUser[id] || [];
      const score = period === "today" ? (userScores[0] || 0) : userScores.length > 0 ? Math.round(userScores.reduce((a, b) => a + b, 0) / userScores.length) : 0;
      let username = "Unknown";
      if (id === user.id) username = myProfile?.username || "You";
      else username = profileMap[id]?.username || "Unknown";
      return { userId: id, username, score, badges: [], rings: { nutrition: 0, hydration: 0, steps: 0, sleep: 0, workout: 0 } };
    }).sort((a, b) => b.score - a.score);
    setLeaderboard(entries);

    // Load challenges
    const { data: participations } = await supabase.from("challenge_participants").select("challenge_id").in("user_id", allIds);
    const challengeIds = Array.from(new Set((participations || []).map(p => p.challenge_id)));
    if (challengeIds.length > 0) {
      const { data: chs } = await supabase.from("challenges").select("*").in("id", challengeIds);
      const { data: parts } = await supabase.from("challenge_participants").select("challenge_id,user_id").in("challenge_id", challengeIds);
      const creatorIds = Array.from(new Set((chs || []).map(c => c.creator_id)));
      const { data: creatorProfiles } = await supabase.from("profiles").select("id,username").in("id", creatorIds);
      const cpMap: Record<string, string> = {};
      (creatorProfiles || []).forEach(p => { cpMap[p.id] = p.username; });
      setChallenges((chs || []).map(ch => ({
        ...ch,
        participants: (parts || []).filter(p => p.challenge_id === ch.id).map(p => p.user_id),
        progress: {},
        creatorName: cpMap[ch.creator_id] || "Unknown",
      })));
    } else {
      setChallenges([]);
    }

    // Load unread counts
    const { data: unreads } = await supabase.from("messages").select("sender_id").eq("receiver_id", user.id).eq("read", false);
    const counts: Record<string, number> = {};
    (unreads || []).forEach(m => { counts[m.sender_id] = (counts[m.sender_id] || 0) + 1; });
    setUnreadCounts(counts);

    setLoading(false);
    setRefreshing(false);
  }, [period]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const loadFeed = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const friendIds = friends.map(f => f.requester_id === user.id ? f.addressee_id : f.requester_id);
    if (!friendIds.length) { setFeedItems([]); return; }
    const { data } = await supabase.from("activity_feed").select("*").in("user_id", friendIds).order("created_at", { ascending: false }).limit(50);
    const { data: profiles } = await supabase.from("profiles").select("id,username").in("id", friendIds);
    const profileMap: Record<string, string> = {};
    (profiles || []).forEach(p => { profileMap[p.id] = p.username; });
    setFeedItems((data || []).map(f => ({ ...f, username: profileMap[f.user_id] || "Friend" })));
  };

  useEffect(() => { if (tab === "feed") loadFeed(); }, [tab]);

  const searchUsers = async () => {
    if (!search.trim()) return;
    const { data } = await supabase.from("profiles").select("id,username").ilike("username", `%${search}%`).neq("id", myId).limit(10);
    setSearchResults(data || []);
  };

  const sendRequest = async (addresseeId: string) => {
    const { error } = await supabase.from("friendships").insert({ requester_id: myId, addressee_id: addresseeId, status: "pending" });
    if (error) { Alert.alert("Error", error.message); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setRequestSent(prev => [...prev, addresseeId]);
    setSearchResults(prev => prev.filter(p => p.id !== addresseeId));
  };

  const acceptRequest = async (id: string) => {
    await supabase.from("friendships").update({ status: "accepted" }).eq("id", id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    loadAll();
  };

  const declineRequest = async (id: string) => {
    await supabase.from("friendships").delete().eq("id", id);
    loadAll();
  };

  const generateInviteLink = async () => {
    const code = Math.random().toString(36).slice(2, 10);
    await supabase.from("friend_invites").insert({ id: Math.random().toString(36).slice(2), inviter_id: myId, code });
    setInviteCode(code);
  };

  const copyInviteLink = async () => {
    if (!inviteCode) return;
    await Share.share({ message: `${BASE_URL}/invite/${inviteCode}` });
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2000);
  };

  const createChallenge = async () => {
    if (!challengeForm.title || !challengeForm.goal) return;
    setChallengeLoading(true);
    const id = Math.random().toString(36).slice(2);
    const start = format(new Date(), "yyyy-MM-dd");
    const end = format(subDays(new Date(), -parseInt(challengeForm.days)), "yyyy-MM-dd");
    await supabase.from("challenges").insert({ id, creator_id: myId, title: challengeForm.title, type: challengeForm.type, goal: parseFloat(challengeForm.goal), start_date: start, end_date: end, invitee_ids: invitedFriends });
    const participants = [myId, ...invitedFriends].map(uid => ({ id: Math.random().toString(36).slice(2), challenge_id: id, user_id: uid }));
    await supabase.from("challenge_participants").insert(participants);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowCreateChallenge(false);
    setChallengeForm({ title: "", type: "steps", goal: "", days: "7" });
    setInvitedFriends([]);
    setChallengeLoading(false);
    loadAll();
  };

  const joinChallenge = async (challengeId: string) => {
    await supabase.from("challenge_participants").insert({ id: Math.random().toString(36).slice(2), challenge_id: challengeId, user_id: myId });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    loadAll();
  };

  const loadChat = async (friend: Profile) => {
    setChatFriend(friend);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("messages").select("*")
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${friend.id}),and(sender_id.eq.${friend.id},receiver_id.eq.${user.id})`)
      .order("created_at", { ascending: true }).limit(100);
    setMessages(data || []);
    await supabase.from("messages").update({ read: true }).eq("receiver_id", user.id).eq("sender_id", friend.id);
    setUnreadCounts(prev => ({ ...prev, [friend.id]: 0 }));
  };

  const sendMessage = async () => {
    if (!msgInput.trim() || !chatFriend) return;
    const msg = { id: Math.random().toString(36).slice(2), sender_id: myId, receiver_id: chatFriend.id, content: msgInput.trim(), created_at: new Date().toISOString(), read: false };
    const { error } = await supabase.from("messages").insert(msg);
    if (!error) {
      setMessages(prev => [...prev, msg]);
      setMsgInput("");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const medalColors = ["#FFD700", "#C0C0C0", "#CD7F32"];
  const challengeTypes = [
    { value: "steps", label: "Steps", unit: "total steps" },
    { value: "workout", label: "Workouts", unit: "sessions" },
    { value: "nutrition", label: "Calories", unit: "total kcal" },
    { value: "hydration", label: "Hydration", unit: "total ml" },
  ];

  const TabBtn = ({ t, label, count }: { t: Tab; label: string; count?: number }) => (
    <Pressable onPress={() => setTab(t)} style={[styles.tabBtn, tab === t && styles.tabBtnActive]}>
      <Text style={[styles.tabBtnText, tab === t && { color: DARK }]}>{label}{count ? ` (${count})` : ""}</Text>
    </Pressable>
  );

  // If in chat mode with a friend
  if (chatFriend) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 16 }}>
          <Pressable onPress={() => setChatFriend(null)}>
            <Text style={{ fontSize: 22 }}>←</Text>
          </Pressable>
          <View style={styles.avatar}>
            <Text style={{ fontWeight: "700", fontSize: 14, color: DARK }}>{chatFriend.username[0].toUpperCase()}</Text>
          </View>
          <Text style={{ fontSize: 16, fontWeight: "800", color: DARK }}>{chatFriend.username}</Text>
        </View>
        <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 8 }} showsVerticalScrollIndicator={false}>
          {messages.length === 0 && <Text style={{ textAlign: "center", color: SUBTITLE, fontSize: 13, marginTop: 40 }}>No messages yet. Say hi!</Text>}
          {messages.map((m: any) => {
            const isMine = m.sender_id !== chatFriend.id;
            return (
              <View key={m.id} style={{ alignItems: isMine ? "flex-end" : "flex-start" }}>
                <View style={{ maxWidth: "75%", padding: 10, paddingHorizontal: 14, borderRadius: 18, borderBottomRightRadius: isMine ? 4 : 18, borderBottomLeftRadius: isMine ? 18 : 4, backgroundColor: isMine ? DARK : "#F1F5F9" }}>
                  <Text style={{ fontSize: 14, fontWeight: "500", lineHeight: 20, color: isMine ? "white" : DARK }}>{m.content}</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
        <View style={{ flexDirection: "row", gap: 8, padding: 12, borderTopWidth: 0.5, borderTopColor: BORDER }}>
          <TextInput
            value={msgInput}
            onChangeText={setMsgInput}
            onSubmitEditing={sendMessage}
            placeholder="Message..."
            placeholderTextColor={TEXT3}
            style={{ flex: 1, padding: 12, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1.5, borderColor: BORDER, backgroundColor: SURFACE, fontSize: 14, color: DARK }}
          />
          <Pressable onPress={sendMessage} style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: DARK, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "white", fontWeight: "700", fontSize: 18 }}>↑</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAll(); }} tintColor={DARK} />}
      >
        {/* Header */}
        <View style={{ paddingTop: 8, marginBottom: 16 }}>
          <Pressable onPress={() => router.back()} style={{ marginBottom: 4 }}>
            <Text style={{ fontSize: 18 }}>←</Text>
          </Pressable>
          <Text style={{ fontSize: 10, fontWeight: "600", letterSpacing: 2, color: SUBTITLE, textTransform: "uppercase" }}>Social</Text>
          <Text style={{ fontSize: 26, fontWeight: "900", color: DARK, marginTop: 4, letterSpacing: -0.5 }}>Friends</Text>
        </View>

        {/* Pending requests */}
        {pending.length > 0 && (
          <View style={[styles.card, { marginBottom: 16 }]}>
            <Text style={[styles.sectionLabel, { color: "#f59e0b" }]}>{pending.length} Friend Request{pending.length > 1 ? "s" : ""}</Text>
            {pending.map(f => (
              <View key={f.id} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12, borderTopWidth: 1, borderTopColor: "#f1f5f9", gap: 12 }}>
                <View style={styles.avatar}>
                  <Text style={{ color: DARK, fontWeight: "700", fontSize: 14 }}>{f.otherUser.username?.[0]?.toUpperCase()}</Text>
                </View>
                <Text style={{ flex: 1, color: DARK, fontWeight: "600", fontSize: 14 }}>{f.otherUser.username}</Text>
                <Pressable onPress={() => declineRequest(f.id)} style={{ paddingHorizontal: 14, paddingVertical: 8 }}>
                  <Text style={{ fontSize: 11, color: SUBTITLE }}>Decline</Text>
                </Pressable>
                <Pressable onPress={() => acceptRequest(f.id)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: DARK }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "white" }}>Accept</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* Tab bar */}
        <View style={styles.tabBar}>
          <TabBtn t="leaderboard" label="Board" />
          <TabBtn t="friends" label="Friends" count={friends.length || undefined} />
          <TabBtn t="challenges" label="Challenges" />
          <TabBtn t="feed" label="Feed" />
          <TabBtn t="add" label="Add" />
        </View>

        {/* LEADERBOARD TAB */}
        {tab === "leaderboard" && (
          <View style={{ gap: 12 }}>
            {/* Period selector */}
            <View style={[styles.card, { flexDirection: "row", padding: 4, gap: 4 }]}>
              {(["today", "week", "month"] as Period[]).map(p => (
                <Pressable key={p} onPress={() => setPeriod(p)} style={[styles.periodBtn, period === p && styles.periodBtnActive]}>
                  <Text style={[styles.periodBtnText, period === p && { color: "white" }]}>{p === "today" ? "Today" : p === "week" ? "Week" : "Month"}</Text>
                </Pressable>
              ))}
            </View>

            {loading ? (
              <ActivityIndicator size="large" color={DARK} style={{ marginTop: 40 }} />
            ) : (
              <View style={styles.card}>
                {leaderboard.map((entry, i) => {
                  const isMe = entry.userId === myId;
                  return (
                    <View key={entry.userId} style={[styles.leaderRow, isMe && { backgroundColor: DARK, borderRadius: 16, marginHorizontal: -16, paddingHorizontal: 20, marginVertical: 2 }, i < leaderboard.length - 1 && !isMe && { borderBottomWidth: 1, borderBottomColor: "#f1f5f9" }]}>
                      <View style={{ width: 28, alignItems: "center" }}>
                        {i < 3 ? <ArcIcon name="trophy" size={20} color={medalColors[i]} /> : <Text style={{ fontSize: 13, color: isMe ? "white" : SUBTITLE, fontWeight: "700" }}>{i + 1}</Text>}
                      </View>
                      <ActivityRingsView rings={entry.rings} size={44} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: isMe ? "white" : DARK, fontWeight: "700", fontSize: 14 }}>
                          {entry.username} {isMe && <Text style={{ color: SUBTITLE, fontSize: 11, fontWeight: "400" }}>(you)</Text>}
                        </Text>
                        {entry.badges.length > 0 && (
                          <View style={{ flexDirection: "row", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                            {entry.badges.map((b, bi) => <Text key={bi} style={{ fontSize: 13 }}>{b.emoji}</Text>)}
                          </View>
                        )}
                      </View>
                      <Text style={{ fontSize: 28, fontWeight: "900", color: isMe ? "white" : DARK }}>{entry.score}</Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Activity Rings Legend */}
            <View style={[styles.card, { padding: 16 }]}>
              <Text style={styles.sectionLabel}>Activity Rings</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
                {[{ color: "#f97316", label: "Nutrition" }, { color: "#3b82f6", label: "Hydration" }, { color: "#22c55e", label: "Steps" }, { color: "#a78bfa", label: "Sleep" }, { color: "#f43f5e", label: "Workout" }].map(r => (
                  <View key={r.label} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: r.color }} />
                    <Text style={{ fontSize: 11, color: SUBTITLE, fontWeight: "600" }}>{r.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* FRIENDS TAB */}
        {tab === "friends" && (
          <View style={{ gap: 12 }}>
            {friends.length === 0 ? (
              <View style={[styles.card, { alignItems: "center", paddingVertical: 40 }]}>
                <Text style={{ color: SUBTITLE, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase" }}>No friends yet</Text>
                <Text style={{ color: "#6b7280", fontSize: 12, marginTop: 8 }}>Add friends via username or share your invite link</Text>
              </View>
            ) : (
              <View style={styles.card}>
                {friends.map((f, i) => (
                  <View key={f.id} style={[{ flexDirection: "row", alignItems: "center", padding: 16, gap: 12 }, i < friends.length - 1 && { borderBottomWidth: 1, borderBottomColor: "#f1f5f9" }]}>
                    <View style={styles.avatar}>
                      <Text style={{ color: DARK, fontWeight: "700", fontSize: 14 }}>{f.otherUser.username?.[0]?.toUpperCase()}</Text>
                    </View>
                    <Text style={{ flex: 1, color: DARK, fontWeight: "600", fontSize: 14 }}>{f.otherUser.username}</Text>
                    <Pressable onPress={() => loadChat(f.otherUser)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: "#e0e7ff" }}>
                      <ArcIcon name="chatBubble" size={12} color="#3730a3" />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* CHALLENGES TAB */}
        {tab === "challenges" && (
          <View style={{ gap: 12 }}>
            <Pressable onPress={() => setShowCreateChallenge(!showCreateChallenge)} style={{ padding: 14, borderRadius: 14, backgroundColor: DARK, alignItems: "center" }}>
              <Text style={{ color: "white", fontWeight: "700", fontSize: 13 }}>{showCreateChallenge ? "Cancel" : "+ Create Challenge"}</Text>
            </Pressable>

            {showCreateChallenge && (
              <View style={[styles.card, { gap: 12 }]}>
                <TextInput
                  placeholder="Challenge title (e.g. Step Battle)"
                  placeholderTextColor={TEXT3}
                  value={challengeForm.title}
                  onChangeText={t => setChallengeForm(f => ({ ...f, title: t }))}
                  style={styles.formInput}
                />
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {challengeTypes.map(ct => (
                    <Pressable key={ct.value} onPress={() => setChallengeForm(f => ({ ...f, type: ct.value }))} style={[styles.typePill, challengeForm.type === ct.value && { backgroundColor: DARK }]}>
                      <Text style={[{ fontSize: 11, fontWeight: "700", color: SUBTITLE }, challengeForm.type === ct.value && { color: "white" }]}>{ct.label}</Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  placeholder={`Goal (${challengeTypes.find(t => t.value === challengeForm.type)?.unit})`}
                  placeholderTextColor={TEXT3}
                  value={challengeForm.goal}
                  onChangeText={t => setChallengeForm(f => ({ ...f, goal: t }))}
                  keyboardType="numeric"
                  style={styles.formInput}
                />
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {["3", "5", "7", "14", "30"].map(d => (
                    <Pressable key={d} onPress={() => setChallengeForm(f => ({ ...f, days: d }))} style={[styles.typePill, challengeForm.days === d && { backgroundColor: DARK }]}>
                      <Text style={[{ fontSize: 11, fontWeight: "700", color: SUBTITLE }, challengeForm.days === d && { color: "white" }]}>{d}d</Text>
                    </Pressable>
                  ))}
                </View>
                {friends.length > 0 && (
                  <View>
                    <Text style={styles.sectionLabel}>Invite Friends</Text>
                    {friends.map(f => {
                      const fid = f.requester_id === myId ? f.addressee_id : f.requester_id;
                      const selected = invitedFriends.includes(fid);
                      return (
                        <Pressable key={fid} onPress={() => setInvitedFriends(prev => selected ? prev.filter(id => id !== fid) : [...prev, fid])} style={[styles.inviteRow, selected && { borderColor: INDIGO, backgroundColor: "#eef2ff" }]}>
                          <View style={[styles.smallAvatar, selected && { backgroundColor: INDIGO }]}>
                            <Text style={{ color: selected ? "white" : DARK, fontWeight: "700", fontSize: 12 }}>{f.otherUser.username?.[0]?.toUpperCase()}</Text>
                          </View>
                          <Text style={{ flex: 1, color: DARK, fontWeight: "600", fontSize: 13 }}>{f.otherUser.username}</Text>
                          {selected && <Text style={{ color: INDIGO, fontSize: 16 }}>✓</Text>}
                        </Pressable>
                      );
                    })}
                  </View>
                )}
                <Pressable onPress={createChallenge} disabled={challengeLoading} style={[styles.indigoBtn, challengeLoading && { opacity: 0.7 }]}>
                  <Text style={{ color: "white", fontWeight: "700", fontSize: 13 }}>
                    {challengeLoading ? "Creating..." : `Create${invitedFriends.length > 0 ? ` & Invite ${invitedFriends.length}` : ""}`}
                  </Text>
                </Pressable>
              </View>
            )}

            {challenges.length === 0 && !showCreateChallenge && (
              <View style={[styles.card, { alignItems: "center", paddingVertical: 40 }]}>
                <Text style={{ color: SUBTITLE, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase" }}>No active challenges</Text>
                <Text style={{ color: "#6b7280", fontSize: 12, marginTop: 8 }}>Create a challenge and compete with friends</Text>
              </View>
            )}

            {challenges.map(ch => {
              const isParticipant = ch.participants.includes(myId);
              const pct = Math.min(((ch.progress[myId] || 0) / ch.goal) * 100, 100);
              const sorted = Object.entries(ch.progress).sort(([, a], [, b]) => b - a);
              return (
                <View key={ch.id} style={styles.card}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
                    <View>
                      <Text style={{ fontSize: 15, fontWeight: "700", color: DARK }}>{ch.title}</Text>
                      <Text style={{ fontSize: 11, color: SUBTITLE, marginTop: 2 }}>by {ch.creatorName} · ends {ch.end_date}</Text>
                    </View>
                    {!isParticipant && (
                      <Pressable onPress={() => joinChallenge(ch.id)} style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: INDIGO }}>
                        <Text style={{ color: "white", fontWeight: "700", fontSize: 11 }}>Join</Text>
                      </Pressable>
                    )}
                  </View>
                  {isParticipant && (
                    <View style={{ marginBottom: 12 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                        <Text style={{ fontSize: 11, color: "#6b7280", fontWeight: "600" }}>Your progress</Text>
                        <Text style={{ fontSize: 11, color: DARK, fontWeight: "700" }}>{(ch.progress[myId] || 0).toLocaleString()} / {ch.goal.toLocaleString()}</Text>
                      </View>
                      <View style={{ height: 6, backgroundColor: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
                        <View style={{ height: "100%", width: `${pct}%`, backgroundColor: INDIGO, borderRadius: 99 }} />
                      </View>
                    </View>
                  )}
                  {sorted.length > 0 && (
                    <View style={{ gap: 8 }}>
                      {sorted.map(([uid, val], i) => {
                        const entry = leaderboard.find(e => e.userId === uid);
                        const name = entry?.username || (uid === myId ? myUsername : "Unknown");
                        const userPct = Math.min((val / ch.goal) * 100, 100);
                        return (
                          <View key={uid}>
                            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                              <Text style={{ fontSize: 12, color: uid === myId ? DARK : "#6b7280", fontWeight: uid === myId ? "700" : "600" }}>
                                {name}
                              </Text>
                              <Text style={{ fontSize: 12, color: DARK, fontWeight: "700" }}>{val.toLocaleString()}</Text>
                            </View>
                            <View style={{ height: 4, backgroundColor: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
                              <View style={{ height: "100%", width: `${userPct}%`, backgroundColor: i === 0 ? "#f59e0b" : "#e5e7eb", borderRadius: 99 }} />
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* FEED TAB */}
        {tab === "feed" && (
          <View style={{ gap: 10 }}>
            {feedItems.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <View style={{ marginBottom: 12 }}><ArcIcon name="chatBubble" size={32} color="#C7C7CC" /></View>
                <Text style={{ fontSize: 15, fontWeight: "700", color: DARK }}>No activity yet</Text>
                <Text style={{ fontSize: 13, color: SUBTITLE, marginTop: 4 }}>Your friends' activity will show here</Text>
              </View>
            ) : feedItems.map((item: any) => {
              const icons: Record<string, ArcIconName> = { workout_logged: "workout", nutrition_logged: "plate", steps_logged: "steps", sleep_logged: "sleep", weight_logged: "scale", achievement_earned: "trophy", challenge_created: "bolt", mood_logged: "heart" };
              const labels: Record<string, string> = { workout_logged: "logged a workout", nutrition_logged: "logged a meal", steps_logged: "logged steps", sleep_logged: "logged sleep", weight_logged: "logged weight", achievement_earned: "earned an achievement", challenge_created: "created a challenge", mood_logged: "logged mood" };
              return (
                <View key={item.id} style={{ backgroundColor: SURFACE, borderRadius: 16, padding: 14, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: BG, alignItems: "center", justifyContent: "center" }}>
                    <ArcIcon name={icons[item.type] || "sparkle"} size={20} color={DARK} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, color: DARK }}>
                      <Text style={{ fontWeight: "700" }}>{item.username}</Text>{" "}
                      <Text style={{ color: "#6b7280" }}>{labels[item.type] || item.type}</Text>
                    </Text>
                    <Text style={{ fontSize: 10, color: "#d1d5db", marginTop: 2 }}>{new Date(item.created_at).toLocaleDateString()}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ADD TAB */}
        {tab === "add" && (
          <View style={{ gap: 12 }}>
            {/* Invite Link */}
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>Invite Link</Text>
              {inviteCode ? (
                <View style={{ gap: 8 }}>
                  <Text style={{ fontSize: 12, color: "#6b7280", backgroundColor: BG, padding: 12, borderRadius: 10 }}>{BASE_URL}/invite/{inviteCode}</Text>
                  <Pressable onPress={copyInviteLink} style={{ padding: 12, borderRadius: 12, backgroundColor: inviteCopied ? "#22c55e" : DARK, alignItems: "center" }}>
                    <Text style={{ color: "white", fontWeight: "700", fontSize: 13 }}>{inviteCopied ? "Copied! ✓" : "Copy Link"}</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable onPress={generateInviteLink} style={{ padding: 12, borderRadius: 12, backgroundColor: DARK, alignItems: "center" }}>
                  <Text style={{ color: "white", fontWeight: "700", fontSize: 13 }}>Generate Invite Link</Text>
                </Pressable>
              )}
            </View>

            {/* Search */}
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>Search by Username</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TextInput
                  placeholder="Search username..."
                  placeholderTextColor={TEXT3}
                  value={search}
                  onChangeText={setSearch}
                  onSubmitEditing={searchUsers}
                  style={[styles.formInput, { flex: 1, marginBottom: 0 }]}
                />
                <Pressable onPress={searchUsers} style={{ paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, backgroundColor: DARK }}>
                  <Text style={{ color: "white", fontWeight: "700", fontSize: 12 }}>Search</Text>
                </Pressable>
              </View>
              {searchResults.length > 0 && (
                <View style={{ marginTop: 12, gap: 8 }}>
                  {searchResults.map(p => (
                    <View key={p.id} style={{ flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: BG, borderRadius: 12 }}>
                      <View style={[styles.smallAvatar, { marginRight: 12 }]}>
                        <Text style={{ color: DARK, fontWeight: "700", fontSize: 13 }}>{p.username?.[0]?.toUpperCase()}</Text>
                      </View>
                      <Text style={{ flex: 1, color: DARK, fontWeight: "600", fontSize: 14 }}>{p.username}</Text>
                      <Pressable
                        onPress={() => sendRequest(p.id)}
                        disabled={requestSent.includes(p.id)}
                        style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: requestSent.includes(p.id) ? "#f1f5f9" : DARK }}
                      >
                        <Text style={{ color: requestSent.includes(p.id) ? SUBTITLE : "white", fontWeight: "700", fontSize: 11 }}>
                          {requestSent.includes(p.id) ? "Sent ✓" : "Add"}
                        </Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: SURFACE, borderRadius: 20, padding: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12 },
  sectionLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 2, color: SUBTITLE, textTransform: "uppercase", marginBottom: 12 },
  tabBar: { flexDirection: "row", gap: 4, backgroundColor: SURFACE, borderRadius: 16, padding: 4, marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12 },
  tabBtn: { flex: 1, padding: 10, borderRadius: 12, alignItems: "center" },
  tabBtnActive: { backgroundColor: "white" },
  tabBtnText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", color: SUBTITLE },
  periodBtn: { flex: 1, padding: 8, borderRadius: 10, alignItems: "center" },
  periodBtnActive: { backgroundColor: DARK },
  periodBtnText: { fontSize: 10, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", color: SUBTITLE },
  leaderRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#e5e7eb", alignItems: "center", justifyContent: "center" },
  smallAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center" },
  formInput: { padding: 12, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: "#f1f5f9", fontSize: 14, color: DARK, backgroundColor: SURFACE },
  typePill: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: "#f1f5f9" },
  inviteRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 2, borderColor: "#f1f5f9", backgroundColor: SURFACE, marginBottom: 6 },
  indigoBtn: { padding: 14, borderRadius: 12, backgroundColor: INDIGO, alignItems: "center" },
});
