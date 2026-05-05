import { useState, useMemo } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/store/useAuthStore";
import { radius } from "@/lib/theme";
import { useColors } from "@/lib/ThemeContext";

export default function AuthScreen() {
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { signIn, signUp } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!email || !password) { setError("Fill in all fields"); return; }
    setLoading(true);
    setError("");
    const result = isSignUp ? await signUp(email, password) : await signIn(email, password);
    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      router.replace("/(tabs)");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, justifyContent: "center", paddingHorizontal: 24 }}>
        <Text style={styles.logo}>Arc</Text>
        <Text style={styles.subtitle}>Your health, optimized.</Text>

        <View style={{ marginTop: 40 }}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.text3}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.text3}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable style={styles.btn} onPress={handleSubmit} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text style={styles.btnText}>{isSignUp ? "Sign Up" : "Sign In"}</Text>
            )}
          </Pressable>

          <Pressable onPress={() => { setIsSignUp(!isSignUp); setError(""); }} style={{ marginTop: 16 }}>
            <Text style={styles.toggleText}>
              {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  logo: { fontSize: 48, fontWeight: "900", color: colors.text, textAlign: "center" },
  subtitle: { fontSize: 16, color: colors.text2, textAlign: "center", marginTop: 4 },
  input: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, fontSize: 16, color: colors.text, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  error: { color: colors.red, fontSize: 13, fontWeight: "600", marginBottom: 12 },
  btn: { backgroundColor: colors.text, borderRadius: radius.lg, padding: 18, alignItems: "center", marginTop: 4 },
  btnText: { color: colors.bg, fontSize: 16, fontWeight: "800" },
  toggleText: { color: colors.text2, fontSize: 14, textAlign: "center" },
});
