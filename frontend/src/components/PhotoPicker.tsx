import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, TextInput, Platform, Alert } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { uploadImage, resolveImg } from "../api";
import { radius, spacing, useThemedStyles } from "../theme";
import { useTheme } from "../context/ThemeContext";

type Pending = { key: string; uri: string; progress: number; error?: string };

type Props = {
  value: string[];
  onChange: (urls: string[]) => void;
  max?: number;
  /** Single mode = one image (cover). Shows a large preview. */
  single?: boolean;
  testID?: string;
  hint?: string;
};

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Thara photo picker: pick from library or camera, uploads to /api/uploads with progress,
 * thumbnails with reorder (◀ ▶), make-cover-first and delete. URL paste kept as an advanced fallback.
 */
export function PhotoPicker({ value, onChange, max = 15, single, testID = "photos", hint }: Props) {
  const { colors } = useTheme();
  const [pending, setPending] = useState<Pending[]>([]);
  const [showUrl, setShowUrl] = useState(false);
  const [url, setUrl] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const styles = useThemedStyles((c) => ({
    row: { flexDirection: "row", gap: 8 },
    thumb: { width: 92, height: 92, borderRadius: radius.md, backgroundColor: c.surface3 },
    cover: { width: "100%", height: 180, borderRadius: radius.md, backgroundColor: c.surface3 },
    rm: { position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center" },
    ctrls: { position: "absolute", bottom: 4, left: 4, right: 4, flexDirection: "row", justifyContent: "space-between" },
    ctrl: { width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center" },
    first: { position: "absolute", top: 4, left: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm, backgroundColor: c.brand },
    firstT: { color: c.onBrand, fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },
    add: { width: 92, height: 92, borderRadius: radius.md, borderWidth: 1, borderStyle: "dashed", borderColor: c.brand, backgroundColor: c.brandTint, alignItems: "center", justifyContent: "center", gap: 4 },
    addT: { color: c.brand, fontSize: 11, fontWeight: "600" },
    bar: { position: "absolute", left: 6, right: 6, bottom: 8, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.25)", overflow: "hidden" },
    barFill: { height: 4, backgroundColor: c.brand },
    overlay: { ...({ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } as const), backgroundColor: "rgba(0,0,0,0.45)", borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
    actions: { flexDirection: "row", gap: 8, marginTop: spacing.md },
    actBtn: { flex: 1, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: c.brand },
    actT: { color: c.brand, fontWeight: "600", fontSize: 13 },
    link: { color: c.textMuted, fontSize: 12, marginTop: spacing.sm, textDecorationLine: "underline" },
    input: { flex: 1, backgroundColor: c.surface2, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, color: c.text, borderWidth: 1, borderColor: c.border, fontSize: 13 },
    ok: { width: 42, borderRadius: radius.md, backgroundColor: c.brand, alignItems: "center", justifyContent: "center" },
    toast: { marginTop: spacing.sm, fontSize: 12 },
    hint: { color: c.textMuted, fontSize: 12, marginTop: 6 },
  }));

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };
  const room = single ? 1 : Math.max(0, max - value.length - pending.length);

  const handleAssets = async (assets: ImagePicker.ImagePickerAsset[]) => {
    const picked = assets.slice(0, single ? 1 : room);
    const ok = picked.filter(a => !a.fileSize || a.fileSize <= MAX_BYTES);
    if (ok.length < picked.length) flash("Some photos were over 5 MB and skipped");
    const items: Pending[] = ok.map(a => ({ key: `${Date.now()}-${Math.random()}`, uri: a.uri, progress: 0 }));
    setPending(p => [...p, ...items]);
    let current = value;
    let done = 0;
    for (let i = 0; i < ok.length; i++) {
      const a = ok[i]; const key = items[i].key;
      try {
        const u = await uploadImage({ uri: a.uri, mimeType: a.mimeType, fileName: a.fileName },
          (pr) => setPending(p => p.map(x => x.key === key ? { ...x, progress: pr } : x)));
        current = single ? [u] : [...current, u];
        onChange(current);
        done++;
        setPending(p => p.filter(x => x.key !== key));
      } catch (e: any) {
        setPending(p => p.map(x => x.key === key ? { ...x, error: e.message } : x));
        setTimeout(() => setPending(p => p.filter(x => x.key !== key)), 3500);
        flash(e.message || "Upload failed");
      }
    }
    if (done) flash(done === 1 ? "Photo uploaded ✓" : `${done} photos uploaded ✓`);
  };

  const pick = async (camera: boolean) => {
    if (room <= 0 && !single) { flash(`Maximum ${max} photos`); return; }
    try {
      if (camera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { Alert.alert("Camera permission needed", "Allow camera access in settings to take photos."); return; }
      } else if (Platform.OS !== "web") {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { Alert.alert("Photos permission needed", "Allow photo access in settings to upload your work."); return; }
      }
      const opts: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"], quality: 0.8,
        allowsMultipleSelection: !single && !camera, selectionLimit: single ? 1 : room,
        allowsEditing: !!single && !camera, aspect: single ? [16, 9] : undefined,
      };
      const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (!res.canceled && res.assets?.length) await handleAssets(res.assets);
    } catch (e: any) { flash(e.message || "Could not open picker"); }
  };

  const move = (i: number, d: number) => {
    const j = i + d; if (j < 0 || j >= value.length) return;
    const next = [...value]; [next[i], next[j]] = [next[j], next[i]]; onChange(next);
  };
  const rm = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const addUrl = () => {
    const u = url.trim(); if (!/^https?:\/\//i.test(u)) { flash("Enter a valid http(s) image URL"); return; }
    onChange(single ? [u] : [...value, u]); setUrl(""); setShowUrl(false);
  };

  return (
    <View testID={testID}>
      {single ? (
        <View>
          {value[0] || pending[0] ? (
            <View>
              <Image source={{ uri: pending[0]?.uri || resolveImg(value[0]) }} style={styles.cover} contentFit="cover" />
              {pending[0] && (
                <View style={styles.overlay}>
                  <Text style={{ color: "#fff", fontWeight: "600" }}>{pending[0].error ? "Failed" : `Uploading ${Math.round(pending[0].progress * 100)}%`}</Text>
                </View>
              )}
            </View>
          ) : (
            <Pressable onPress={() => pick(false)} style={[styles.add, { width: "100%", height: 150 }]} testID={`${testID}-empty`}>
              <Ionicons name="image-outline" size={28} color={colors.brand} />
              <Text style={styles.addT}>Add a cover photo</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {value.map((u, i) => (
            <View key={`${u}-${i}`}>
              <Image source={{ uri: resolveImg(u) }} style={styles.thumb} contentFit="cover" />
              {i === 0 && <View style={styles.first}><Text style={styles.firstT}>FIRST</Text></View>}
              <Pressable onPress={() => rm(i)} style={styles.rm} testID={`${testID}-rm-${i}`}><Ionicons name="close" size={13} color="#fff" /></Pressable>
              {value.length > 1 && (
                <View style={styles.ctrls}>
                  <Pressable onPress={() => move(i, -1)} style={[styles.ctrl, i === 0 && { opacity: 0.3 }]} testID={`${testID}-left-${i}`}><Ionicons name="chevron-back" size={13} color="#fff" /></Pressable>
                  <Pressable onPress={() => move(i, 1)} style={[styles.ctrl, i === value.length - 1 && { opacity: 0.3 }]} testID={`${testID}-right-${i}`}><Ionicons name="chevron-forward" size={13} color="#fff" /></Pressable>
                </View>
              )}
            </View>
          ))}
          {pending.map(p => (
            <View key={p.key}>
              <Image source={{ uri: p.uri }} style={[styles.thumb, { opacity: 0.6 }]} contentFit="cover" />
              {p.error ? <View style={styles.overlay}><Ionicons name="alert-circle" size={22} color={colors.error} /></View> :
                <View style={styles.bar}><View style={[styles.barFill, { width: `${Math.round(p.progress * 100)}%` }]} /></View>}
            </View>
          ))}
          {room > 0 && (
            <Pressable onPress={() => pick(false)} style={styles.add} testID={`${testID}-add`}>
              <Ionicons name="add" size={24} color={colors.brand} />
              <Text style={styles.addT}>Add photos</Text>
            </Pressable>
          )}
        </ScrollView>
      )}

      <View style={styles.actions}>
        <Pressable onPress={() => pick(false)} style={styles.actBtn} testID={`${testID}-library`}>
          <Ionicons name="images-outline" size={16} color={colors.brand} />
          <Text style={styles.actT}>{single && value[0] ? "Replace" : "Gallery"}</Text>
        </Pressable>
        {Platform.OS !== "web" && (
          <Pressable onPress={() => pick(true)} style={styles.actBtn} testID={`${testID}-camera`}>
            <Ionicons name="camera-outline" size={16} color={colors.brand} />
            <Text style={styles.actT}>Camera</Text>
          </Pressable>
        )}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {toast ? <Text style={[styles.toast, { color: /fail|error|skip|max|valid|could/i.test(toast) ? colors.error : colors.success }]}>{toast}</Text> : null}

      <Pressable onPress={() => setShowUrl(s => !s)}><Text style={styles.link}>{showUrl ? "Hide" : "Advanced: paste image URL"}</Text></Pressable>
      {showUrl && (
        <View style={[styles.row, { marginTop: 6 }]}>
          <TextInput value={url} onChangeText={setUrl} placeholder="https://…" placeholderTextColor={colors.textMuted}
            autoCapitalize="none" style={styles.input} testID={`${testID}-url`} />
          <Pressable onPress={addUrl} style={styles.ok} testID={`${testID}-url-add`}><Ionicons name="checkmark" size={18} color={colors.onBrand} /></Pressable>
        </View>
      )}
    </View>
  );
}
