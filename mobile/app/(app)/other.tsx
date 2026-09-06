import { router } from "expo-router";
import { AppShell } from "../../src/ui/app-shell";
import {
  Card,
  Header,
  PrimaryButton,
  ScrollScreen,
  colors,
} from "../../src/ui/components";

export default function OtherRoute() {
  return (
    <AppShell active="other">
      <ScrollScreen>
        <Header
          eyebrow="MORE"
          title="Other"
          subtitle="Workspace budgets, preferences, and the rest of your Finwise tools."
        />
        <Card>
          <Header
            eyebrow="WORKSPACE"
            title="Budgets"
            subtitle="Shared by every account in this workspace."
          />
          <PrimaryButton
            label="Manage budgets"
            onPress={() => router.push("/(app)/budgets")}
          />
        </Card>
        <Card>
          <Header
            eyebrow="ACTIVITY"
            title="Transactions"
            subtitle="Review your complete ledger history."
          />
          <PrimaryButton
            label="View transactions"
            onPress={() => router.push("/(app)/transactions")}
          />
        </Card>
        <Card style={{ backgroundColor: colors.tealSoft }}>
          <Header
            eyebrow="PERSONALIZE"
            title="Settings"
            subtitle="Theme, language, security, and offline drafts."
          />
          <PrimaryButton
            label="Open settings"
            onPress={() => router.push("/(app)/settings")}
          />
        </Card>
      </ScrollScreen>
    </AppShell>
  );
}
