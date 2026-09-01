import { router } from "expo-router";
import {
  AppState,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/auth-context";
import { useWorkspace } from "../app/providers";
import { colors } from "./components";
import { MobileOutboxRepository } from "../sync/mobile-outbox-repository";
import { isWorkspaceQueryFor } from "../app/workspace-query-scope";

export type MobileSection =
  | "overview"
  | "transactions"
  | "budgets"
  | "reports"
  | "group"
  | "inbox"
  | "accounts"
  | "settings";

export function AppShell({
  active,
  children,
}: {
  active: MobileSection;
  children: ReactNode;
}) {
  const { session, api } = useAuth();
  const { bootstrap, workspace, selectWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [syncError, setSyncError] = useState<string | null>(null);

  const syncPendingDrafts = useCallback(async () => {
    if (!session?.user.id || !workspace?.id) return;
    try {
      const repository = new MobileOutboxRepository(
        session.user.id,
        workspace.id,
        api,
      );
      const results = await repository.syncPending();
      const needsAction = results.some(
        (record) => record.state === "NEEDS_USER_ACTION",
      );
      const remainsQueued = results.some(
        (record) => record.state === "RETRYABLE_FAILURE",
      );
      setSyncError(
        needsAction
          ? "Some offline drafts need your attention in Settings."
          : remainsQueued
            ? "Offline drafts remain queued. Retry when you are online."
            : null,
      );
      if (results.some((record) => record.state === "SYNCED")) {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: ["overview", workspace.id],
          }),
          queryClient.invalidateQueries({
            queryKey: ["accounts", workspace.id],
          }),
          queryClient.invalidateQueries({
            queryKey: ["transactions", workspace.id],
          }),
        ]);
      }
    } catch {
      setSyncError("Offline drafts remain queued. Retry when you are online.");
    }
  }, [api, queryClient, session?.user.id, workspace?.id]);

  useEffect(() => {
    void syncPendingDrafts();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void syncPendingDrafts();
    });
    return () => subscription.remove();
  }, [syncPendingDrafts]);

  function switchWorkspace(nextWorkspaceId: string) {
    const previousWorkspaceId = workspace?.id;
    if (!previousWorkspaceId || previousWorkspaceId === nextWorkspaceId) {
      selectWorkspace(nextWorkspaceId);
      return;
    }

    // Change the active scope immediately so old workspace data is no longer
    // renderable; abort transport and remove only the previous scope.
    api.cancelWorkspaceRequests(previousWorkspaceId);
    selectWorkspace(nextWorkspaceId);
    const previousScope = (query: { queryKey: readonly unknown[] }) =>
      isWorkspaceQueryFor(query.queryKey, previousWorkspaceId);
    void queryClient.cancelQueries({ predicate: previousScope }).then(
      () => queryClient.removeQueries({ predicate: previousScope }),
      () => queryClient.removeQueries({ predicate: previousScope }),
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topbar}>
        <View>
          <Text style={styles.brand}>finwise</Text>
          <Text style={styles.workspace}>
            {workspace?.name ?? "Loading workspace…"}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/(app)/settings")}
          style={styles.avatar}
        >
          <Text style={styles.avatarText}>
            {initials(session?.user.displayName ?? "FW")}
          </Text>
        </Pressable>
      </View>
      {syncError ? (
        <Text accessibilityRole="alert" style={styles.syncNotice}>
          {syncError}
        </Text>
      ) : null}
      {bootstrap && bootstrap.workspaces.length > 1 ? (
        <View style={styles.workspacePicker}>
          {bootstrap.workspaces.map((candidate) => (
            <Pressable
              key={candidate.id}
              onPress={() => switchWorkspace(candidate.id)}
              style={[
                styles.workspaceChip,
                candidate.id === workspace?.id && styles.workspaceChipActive,
              ]}
            >
              <Text
                style={[
                  styles.workspaceChipText,
                  candidate.id === workspace?.id &&
                    styles.workspaceChipTextActive,
                ]}
              >
                {candidate.name}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={styles.body}>{children}</View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.navContent}
        style={styles.nav}
      >
        {(
          [
            "overview",
            "accounts",
            "transactions",
            "budgets",
            "reports",
            "group",
            "inbox",
          ] as MobileSection[]
        ).map((section) => (
          <Pressable
            key={section}
            accessibilityRole="button"
            accessibilityState={{ selected: active === section }}
            onPress={() =>
              router.replace(
                section === "overview" ? "/(app)" : `/(app)/${section}`,
              )
            }
            style={styles.navItem}
          >
            <Text
              style={[styles.navIcon, active === section && styles.navActive]}
            >
              {navGlyph(section)}
            </Text>
            <Text
              style={[styles.navLabel, active === section && styles.navActive]}
            >
              {section === "group"
                ? "Group"
                : section === "inbox"
                  ? "Inbox"
                  : section[0]?.toUpperCase() + section.slice(1)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function initials(value: string): string {
  return (
    value
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "FW"
  );
}
function navGlyph(section: MobileSection): string {
  return (
    {
      overview: "◈",
      transactions: "↗",
      budgets: "▥",
      reports: "▤",
      group: "◎",
      inbox: "⌁",
      accounts: "▣",
      settings: "●",
    }[section] ?? "•"
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  topbar: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brand: {
    color: colors.teal,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  workspace: { color: colors.muted, fontSize: 12, marginTop: 2 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#f6ddd0",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#a75e46", fontWeight: "800", fontSize: 12 },
  body: { flex: 1 },
  syncNotice: {
    color: colors.amber,
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  workspacePicker: {
    paddingHorizontal: 20,
    flexDirection: "row",
    gap: 8,
    paddingBottom: 10,
  },
  workspaceChip: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  workspaceChipActive: {
    borderColor: colors.teal,
    backgroundColor: colors.tealSoft,
  },
  workspaceChipText: { color: colors.muted, fontSize: 12 },
  workspaceChipTextActive: { color: colors.teal, fontWeight: "700" },
  nav: {
    height: 72,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  navContent: {
    flexGrow: 1,
    minWidth: "100%",
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 8,
  },
  navItem: { alignItems: "center", gap: 3, minWidth: 62, paddingHorizontal: 6 },
  navIcon: { color: "#90a39f", fontSize: 20, lineHeight: 22 },
  navLabel: { color: "#809490", fontSize: 10, fontWeight: "700" },
  navActive: { color: colors.teal },
});
