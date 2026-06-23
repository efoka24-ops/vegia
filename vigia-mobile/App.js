import { useState } from 'react';
import {
  SafeAreaView, ScrollView, View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, StyleSheet, StatusBar, Platform,
} from 'react-native';
import { verify } from './src/api';
import { C, levelColor, levelLabel } from './src/theme';

const TYPES = [
  { key: 'text', label: '📰  Texte', placeholder: 'Collez un message ou une information à vérifier…', multiline: true },
  { key: 'url', label: '🔗  Lien', placeholder: 'https://exemple.com/...', multiline: false },
  { key: 'account', label: '👤  Compte', placeholder: "Nom du compte / profil à vérifier", multiline: false },
];

export default function App() {
  const [type, setType] = useState('text');
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const current = TYPES.find(t => t.key === type);

  const onVerify = async () => {
    if (!value.trim()) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const r = await verify(type, value.trim());
      setResult(r);
    } catch (e) {
      setError("Impossible de joindre VigIA. Vérifiez votre connexion.");
    } finally {
      setLoading(false);
    }
  };

  const risk = result && result.score != null ? Math.round(result.score * 100) : null;
  const moduleLabel = result && result.modules
    ? (Object.values(result.modules)[0] || {}).label
    : null;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.dark} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        <View style={styles.header}>
          <Text style={styles.logo}>Vig<Text style={{ color: C.yellow }}>IA</Text></Text>
          <Text style={styles.tagline}>Vérifiez deepfakes, désinformation & arnaques</Text>
        </View>

        <View style={styles.tabs}>
          {TYPES.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, type === t.key && styles.tabActive]}
              onPress={() => { setType(t.key); setResult(null); setError(''); }}
            >
              <Text style={[styles.tabText, type === t.key && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput
          style={[styles.input, current.multiline && styles.inputMultiline]}
          placeholder={current.placeholder}
          placeholderTextColor="#5a7a6b"
          value={value}
          onChangeText={setValue}
          multiline={current.multiline}
          autoCapitalize={type === 'url' ? 'none' : 'sentences'}
          autoCorrect={type !== 'url'}
        />

        <TouchableOpacity style={styles.btn} onPress={onVerify} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>🛡  Vérifier avec VigIA</Text>}
        </TouchableOpacity>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {result && (
          <View style={[styles.resultCard, { borderColor: levelColor(result.level) }]}>
            <Text style={[styles.resultLevel, { color: levelColor(result.level) }]}>
              {levelLabel(result.level)}
            </Text>
            {risk != null && (
              <Text style={styles.resultRisk}>
                Indice de risque : <Text style={{ color: levelColor(result.level), fontWeight: '800' }}>{risk}%</Text>
                <Text style={styles.scale}>  (0 % = sûr · 100 % = très suspect)</Text>
              </Text>
            )}
            {moduleLabel ? <Text style={styles.resultLabel}>{moduleLabel}</Text> : null}
            {result.explanation ? <Text style={styles.resultExpl}>{result.explanation}</Text> : null}
          </View>
        )}

        <Text style={styles.footer}>
          Version bêta · résultats indicatifs · aucune donnée personnelle de compte collectée.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.dark, paddingTop: Platform.OS === 'android' ? 28 : 0 },
  scroll: { padding: 22, paddingBottom: 60 },
  header: { alignItems: 'center', marginTop: 24, marginBottom: 28 },
  logo: { fontSize: 40, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  tagline: { color: C.muted, fontSize: 13, marginTop: 6, textAlign: 'center' },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 11, borderRadius: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  tabActive: { backgroundColor: 'rgba(10,92,66,0.35)', borderColor: C.green },
  tabText: { color: C.muted, fontSize: 13, fontWeight: '700' },
  tabTextActive: { color: '#fff' },
  input: { backgroundColor: '#0c1813', borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 15, color: '#fff', fontSize: 15 },
  inputMultiline: { minHeight: 120, textAlignVertical: 'top' },
  btn: { backgroundColor: C.green, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 16 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  error: { color: '#f87171', marginTop: 16, textAlign: 'center' },
  resultCard: { marginTop: 22, backgroundColor: C.card, borderWidth: 1.5, borderRadius: 16, padding: 18 },
  resultLevel: { fontSize: 18, fontWeight: '800' },
  resultRisk: { color: '#cdddd4', fontSize: 14, marginTop: 10 },
  scale: { color: '#7a8f84', fontSize: 11 },
  resultLabel: { color: '#fff', fontSize: 15, fontWeight: '700', marginTop: 12 },
  resultExpl: { color: C.muted, fontSize: 13, marginTop: 8, lineHeight: 19 },
  footer: { color: '#4a7c5f', fontSize: 11, textAlign: 'center', marginTop: 34 },
});
