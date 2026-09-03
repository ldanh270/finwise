import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { ComponentProps, PropsWithChildren } from "react";
import type { MoneyDto } from "@finwise/api-client";

export const colors = {
  ink: "#173d3d",
  muted: "#667d79",
  teal: "#087f78",
  tealSoft: "#e4f3f0",
  surface: "#ffffff",
  canvas: "#f7faf9",
  border: "#e0eae8",
  danger: "#b34e4e",
  amber: "#ad7700",
  purple: "#7659a9",
};

export function Screen({ children }: PropsWithChildren) {
  return <View style={styles.screen}>{children}</View>;
}
export function ScrollScreen({ children }: PropsWithChildren) {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
    >
      {children}
    </ScrollView>
  );
}
export function Header({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.header}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}
export function Card({
  children,
  style,
}: PropsWithChildren<{ style?: ComponentProps<typeof View>["style"] }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}
export function Label({ children }: PropsWithChildren) {
  return <Text style={styles.label}>{children}</Text>;
}
export function Money({
  value,
  compact = false,
}: {
  value: MoneyDto | string;
  compact?: boolean;
}) {
  const minorUnits = typeof value === "string" ? value : value.minorUnits;
  const formatted = formatVnd(minorUnits);
  return (
    <Text style={[styles.money, compact && styles.moneyCompact]}>
      {formatted} ₫
    </Text>
  );
}
export function formatVnd(minorUnits: string): string {
  try {
    return BigInt(minorUnits).toLocaleString("vi-VN");
  } catch {
    return "—";
  }
}
export function PrimaryButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primary,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}
export function SecondaryButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.secondary,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={styles.secondaryText}>{label}</Text>
    </Pressable>
  );
}
export function TextField({
  label,
  ...props
}: ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={styles.field}>
      <Label>{label}</Label>
      <TextInput
        {...props}
        placeholderTextColor="#9aa9a8"
        style={styles.input}
      />
    </View>
  );
}
export function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly { label: string; value: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Label>{label}</Label>
      <View style={styles.selectRow}>
        {options.map((option) => (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={`${label}: ${option.label}`}
            accessibilityState={{ selected: option.value === value }}
            onPress={() => onChange(option.value)}
            style={[
              styles.selectOption,
              option.value === value && styles.selectOptionActive,
            ]}
          >
            <Text
              style={[
                styles.selectText,
                option.value === value && styles.selectTextActive,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
export function StatePanel({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <Card style={styles.state}>
      <Text style={styles.stateTitle}>{title}</Text>
      {description ? (
        <Text style={styles.stateDescription}>{description}</Text>
      ) : null}
      {action ? <SecondaryButton {...action} /> : null}
    </Card>
  );
}
export function InlineError({ message }: { message: string }) {
  return (
    <Text accessibilityRole="alert" style={styles.error}>
      {message}
    </Text>
  );
}
export function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  scroll: { padding: 20, gap: 16, paddingBottom: 20 },
  header: { gap: 6, marginBottom: 4 },
  eyebrow: {
    color: "#78908b",
    fontSize: 11,
    letterSpacing: 1.3,
    fontWeight: "800",
  },
  title: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: "600",
    letterSpacing: -0.6,
  },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 21 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  money: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  moneyCompact: { fontSize: 16 },
  label: { color: "#56716d", fontSize: 12, fontWeight: "700" },
  field: { gap: 7 },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: "#d6e3e1",
    borderRadius: 11,
    paddingHorizontal: 12,
    color: colors.ink,
    backgroundColor: "#fcfefd",
    fontSize: 16,
  },
  primary: {
    minHeight: 46,
    backgroundColor: colors.teal,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryText: { color: "#fff", fontWeight: "800" },
  secondary: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: "#b9d3cf",
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  secondaryText: { color: colors.teal, fontWeight: "800" },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.5 },
  state: { alignItems: "flex-start", paddingVertical: 22 },
  stateTitle: { color: colors.ink, fontSize: 17, fontWeight: "700" },
  stateDescription: { color: colors.muted, lineHeight: 20 },
  error: { color: colors.danger, lineHeight: 19 },
  divider: { height: 1, backgroundColor: colors.border },
  selectRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  selectOption: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  selectOptionActive: {
    backgroundColor: colors.tealSoft,
    borderColor: colors.teal,
  },
  selectText: { color: colors.muted, fontSize: 13 },
  selectTextActive: { color: colors.teal, fontWeight: "700" },
});
