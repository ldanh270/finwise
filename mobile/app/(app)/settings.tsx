import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Text, View } from "react-native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { AppShell } from "../../src/ui/app-shell";
import {
  Card,
  Header,
  InlineError,
  Money,
  PrimaryButton,
  ScrollScreen,
  SecondaryButton,
  StatePanel,
  colors,
  Divider,
} from "../../src/ui/components";
import { useAuth } from "../../src/auth/auth-context";
import { useWorkspace } from "../../src/app/providers";
import { MobileOutboxRepository } from "../../src/sync/mobile-outbox-repository";
import type { OutboxRecord } from "../../src/sync/outbox";
import { draftExportCsv } from "../../src/sync/draft-export";

export default function SettingsRoute() {
  const { api, session, signOut } = useAuth();
  const { bootstrap, workspaceId } = useWorkspace();
  const [drafts, setDrafts] = useState<readonly OutboxRecord[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const repository = useMemo(
    () =>
      session?.user.id && workspaceId
        ? new MobileOutboxRepository(session.user.id, workspaceId, api)
        : null,
    [api, session?.user.id, workspaceId],
  );
  const workspaceIds = useMemo(() => {
    const ids = bootstrap?.workspaces.map((workspace) => workspace.id) ?? [];
    return ids.length || !workspaceId ? ids : [workspaceId];
  }, [bootstrap?.workspaces, workspaceId]);
  const load = useCallback(async () => {
    if (!repository) return;
    setDrafts(await repository.list());
  }, [repository]);
  useEffect(() => {
    void load();
  }, [load]);

  async function sync() {
    if (!session?.user.id || workspaceIds.length === 0) return;
    try {
      let syncedCount = 0;
      let unresolvedCount = 0;
      let actionRequiredCount = 0;
      for (const id of workspaceIds) {
        const results = await new MobileOutboxRepository(
          session.user.id,
          id,
          api,
        ).syncPending();
        syncedCount += results.filter(
          (record) => record.state === "SYNCED",
        ).length;
        unresolvedCount += results.filter(
          (record) => record.state === "RETRYABLE_FAILURE",
        ).length;
        actionRequiredCount += results.filter(
          (record) => record.state === "NEEDS_USER_ACTION",
        ).length;
      }
      await load();
      setFeedback(
        actionRequiredCount > 0
          ? `${actionRequiredCount} draft${actionRequiredCount === 1 ? "" : "s"} need your attention.`
          : unresolvedCount > 0
            ? `${syncedCount} draft${syncedCount === 1 ? "" : "s"} synced; ${unresolvedCount} will retry when online.`
            : `${syncedCount} draft${syncedCount === 1 ? "" : "s"} synced. Confirmed balances remain server-owned.`,
      );
    } catch (error: unknown) {
      setFeedback(error instanceof Error ? error.message : "Sync failed.");
    }
  }
  async function logout() {
    const canLogout = !session?.user.id
      ? true
      : await canLogoutAcrossWorkspaces();
    if (canLogout) {
      await signOut();
      router.replace("/login");
      return;
    }
    Alert.alert(
      "Pending drafts",
      "Sync, export, or discard offline drafts before logging out.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Sync now", onPress: () => void sync() },
      ],
    );
  }
  async function canLogoutAcrossWorkspaces(): Promise<boolean> {
    if (!session?.user.id) return true;
    for (const id of workspaceIds) {
      if (
        !(await new MobileOutboxRepository(
          session.user.id,
          id,
          api,
        ).canLogout())
      ) {
        return false;
      }
    }
    return true;
  }
  async function discard(id: string) {
    if (!repository) return;
    await repository.discard(id);
    await load();
  }

  async function exportDrafts() {
    if (!repository) return;
    const pending = drafts.filter(isPendingDraft);
    if (pending.length === 0) {
      setFeedback("There are no pending drafts to export.");
      return;
    }
    setExporting(true);
    try {
      const directory =
        FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
      if (!directory)
        throw new Error("File storage is unavailable on this device.");
      const uri = `${directory}finwise-offline-drafts-${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(uri, draftExportCsv(pending), {
        encoding: FileSystem.EncodingType.UTF8,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "text/csv",
          UTI: "public.comma-separated-values-text",
          dialogTitle: "Export Finwise offline drafts",
        });
      }
      const exported = await repository.markExported(
        pending.map((draft) => draft.clientCommandId),
      );
      await load();
      setFeedback(
        `${exported.length} draft${exported.length === 1 ? "" : "s"} exported. You can sign out; confirmed balances remain server-owned.`,
      );
    } catch (error: unknown) {
      setFeedback(
        error instanceof Error ? error.message : "Draft export failed.",
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <AppShell active="settings">
      <ScrollScreen>
        <Header
          eyebrow="PROFILE & SECURITY"
          title="Settings"
          subtitle={session?.user.email ?? "Your Finwise session"}
        />
        <Card>
          <Header eyebrow="SESSION" title="Secure session" />
          <Text style={{ color: colors.muted, lineHeight: 20 }}>
            Access and refresh tokens are stored in SecureStore. Workspace data
            is partitioned by user and workspace.
          </Text>
          <SecondaryButton
            label="Back to overview"
            onPress={() => router.replace("/(app)")}
          />
          <PrimaryButton label="Sign out" onPress={() => void logout()} />
        </Card>
        <Card>
          <Header
            eyebrow="OFFLINE DRAFTS"
            title={`${drafts.filter(isPendingDraft).length} pending`}
          />
          <Text style={{ color: colors.muted, lineHeight: 20 }}>
            Pending drafts never alter confirmed balances. Sync them when online
            or export/discard them explicitly.
          </Text>
          {drafts.filter(isPendingDraft).length === 0 ? (
            <StatePanel title="No pending drafts" />
          ) : (
            drafts.filter(isPendingDraft).map((draft) => (
              <View key={draft.clientCommandId} style={{ gap: 7 }}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={{ color: colors.ink, fontWeight: "700" }}>
                    {draft.kind}
                  </Text>
                  <Money value={draft.amount} compact />
                </View>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {draft.description || "Untitled draft"} · {draft.state}
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <SecondaryButton
                    label="Discard"
                    onPress={() => void discard(draft.clientCommandId)}
                  />
                  <Text
                    style={{
                      color: colors.muted,
                      fontSize: 11,
                      alignSelf: "center",
                    }}
                  >
                    Attempts {draft.attempts}
                  </Text>
                </View>
                <Divider />
              </View>
            ))
          )}
          <PrimaryButton
            label="Sync pending drafts"
            onPress={() => void sync()}
          />
          <SecondaryButton
            label={exporting ? "Exporting…" : "Export pending drafts"}
            disabled={exporting}
            onPress={() => void exportDrafts()}
          />
        </Card>
        {feedback ? <InlineError message={feedback} /> : null}
      </ScrollScreen>
    </AppShell>
  );
}

function isPendingDraft(draft: OutboxRecord): boolean {
  return (
    draft.state !== "SYNCED" &&
    draft.state !== "DISCARDED" &&
    draft.state !== "EXPORTED"
  );
}
