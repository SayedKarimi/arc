import { useEffect, useState } from "react";
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase/client";
import { ArcIcon, ArcIconName } from "@/components/ArcIcon";

export default function InviteScreen() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const [status, setStatus] = useState<"loading" | "success" | "error" | "already">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (code) handleInvite();
  }, [code]);

  const handleInvite = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth" as any); return; }

      const { data: invite } = await supabase
        .from("friend_invites")
        .select("*")
        .eq("code", code)
        .single();

      if (!invite) { setStatus("error"); setMessage("Invite link not found or expired."); return; }
      if (invite.inviter_id === user.id) { setStatus("error"); setMessage("That's your own invite link!"); return; }
      if (invite.used_by) { setStatus("already"); setMessage("This invite has already been used."); return; }

      const { data: existing } = await supabase
        .from("friendships")
        .select("id")
        .or(`and(requester_id.eq.${user.id},addressee_id.eq.${invite.inviter_id}),and(requester_id.eq.${invite.inviter_id},addressee_id.eq.${user.id})`)
        .single();

      if (existing) { setStatus("already"); setMessage("You're already friends with this person!"); return; }

      const { error } = await supabase.from("friendships").insert({
        id: Math.random().toString(36).slice(2),
        requester_id: user.id,
        addressee_id: invite.inviter_id,
        status: "pending",
      });

      if (error) { setStatus("error"); setMessage("Something went wrong. Try again."); return; }

      await supabase.from("friend_invites").update({ used_by: user.id, used_at: new Date().toISOString() }).eq("code", code);

      setStatus("success");
      setMessage("Friend request sent!");
      setTimeout(() => router.push("/friends" as any), 2000);
    } catch {
      setStatus("error");
      setMessage("Something went wrong.");
    }
  };

  const statusIcon: ArcIconName | null = status === "loading" ? null : status === "success" ? "party" : status === "already" ? "check" : "x";
  const statusColor = status === "success" ? "#22c55e" : status === "already" ? "#22c55e" : "#ef4444";

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        {status === "loading" ? (
          <ActivityIndicator size="large" color="#1C1C1E" />
        ) : (
          statusIcon ? <ArcIcon name={statusIcon} size={32} color={statusColor} /> : null
        )}
        <Text style={styles.message}>
          {status === "loading" ? "Processing invite..." : message}
        </Text>
        {status === "success" && (
          <Text style={{ fontSize: 13, color: "#9ca3af", marginTop: 8 }}>Redirecting to Friends...</Text>
        )}
        {(status === "error" || status === "already") && (
          <Pressable onPress={() => router.push("/friends" as any)} style={styles.btn}>
            <Text style={{ color: "white", fontWeight: "700", fontSize: 13 }}>Go to Friends</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f7f8fc", alignItems: "center", justifyContent: "center", padding: 24 },
  card: { backgroundColor: "white", borderRadius: 24, padding: 40, alignItems: "center", width: "100%", maxWidth: 320, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 24, shadowOffset: { width: 0, height: 2 }, elevation: 8 },
  message: { fontSize: 18, fontWeight: "700", color: "#111118", marginTop: 16, textAlign: "center" },
  btn: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, backgroundColor: "#111118" },
});
