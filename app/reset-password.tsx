import { useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase/client";

const BG = "#09090b";
const SURFACE = "#18181b";
const BORDER = "#27272a";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isUpdate, setIsUpdate] = useState(false);

  const requestReset = async () => {
    if (!email.trim()) { setError("Email required."); return; }
    setLoading(true);
    setError("");
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "https://lifeos-iota-wine.vercel.app/auth/reset",
    });
    if (err) setError(err.message);
    else setMessage("Check your email for a reset link.");
    setLoading(false);
  };

  const updatePassword = async () => {
    if (!password) { setError("Password required."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    if (password.length < 6) { setError("Must be at least 6 characters."); return; }
    setLoading(true);
    setError("");
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) setError(err.message);
    else { setMessage("Password updated! Redirecting..."); setTimeout(() => router.push("/auth" as any), 1500); }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={{ marginBottom: 20 }}>
          <Text style={styles.brand}>Arc</Text>
          <Text style={styles.title}>{isUpdate ? "Set New Password" : "Reset Password"}</Text>
        </View>

        {message ? (
          <View style={styles.messageCard}>
            <Text style={{ color: "#34d399", fontSize: 14 }}>{message}</Text>
          </View>
        ) : (
          <>
            {!isUpdate && (
              <TextInput
                placeholder="Your email"
                placeholderTextColor="#52525b"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.input}
              />
            )}
            {isUpdate && (
              <>
                <TextInput
                  placeholder="New password"
                  placeholderTextColor="#52525b"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  style={styles.input}
                />
                <TextInput
                  placeholder="Confirm password"
                  placeholderTextColor="#52525b"
                  value={confirm}
                  onChangeText={setConfirm}
                  secureTextEntry
                  style={[styles.input, { marginTop: 12 }]}
                />
              </>
            )}
            {!!error && <Text style={styles.error}>{error}</Text>}
            <Pressable
              onPress={isUpdate ? updatePassword : requestReset}
              disabled={loading}
              style={[styles.button, { opacity: loading ? 0.6 : 1 }]}
            >
              <Text style={styles.buttonText}>
                {loading ? "Please wait..." : isUpdate ? "Update Password" : "Send Reset Link"}
              </Text>
            </Pressable>
          </>
        )}

        <Pressable onPress={() => router.push("/auth" as any)} style={{ marginTop: 20, alignItems: "center" }}>
          <Text style={{ color: "#52525b", fontSize: 12, letterSpacing: 1, textTransform: "uppercase" }}>
            Back to Login
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "center", padding: 24 },
  content: { width: "100%", maxWidth: 360 },
  brand: { fontSize: 10, fontWeight: "600", letterSpacing: 3, color: "#52525b", textTransform: "uppercase", marginBottom: 8 },
  title: { fontSize: 26, fontWeight: "700", color: "white" },
  input: { width: "100%", backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER, borderRadius: 16, padding: 16, color: "white", fontSize: 15, marginTop: 12 },
  messageCard: { backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER, borderRadius: 16, padding: 20 },
  error: { color: "#f87171", fontSize: 13, marginTop: 12 },
  button: { width: "100%", padding: 16, borderRadius: 16, backgroundColor: "white", marginTop: 20, alignItems: "center" },
  buttonText: { color: "black", fontWeight: "700", fontSize: 13, letterSpacing: 1, textTransform: "uppercase" },
});
