import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../auth/auth-context";
import { useWorkspace } from "../../app/providers";
import {
  Card,
  Header,
  InlineError,
  PrimaryButton,
  ScrollScreen,
  SelectField,
  TextField,
  colors,
} from "../../ui/components";
import { SUPPORTED_CURRENCIES, type CurrencyCode } from "@finwise/api-client";

const ACCOUNT_ICONS = [
  { label: "Cash", value: "cash" },
  { label: "Wallet", value: "wallet" },
  { label: "Bank", value: "bank" },
  { label: "Card", value: "card" },
  { label: "Savings", value: "savings" },
] as const;

export function OnboardingScreen() {
  const { api } = useAuth();
  const { retryBootstrap, selectWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [workspaceName, setWorkspaceName] = useState("");
  const [accountName, setAccountName] = useState("Cash");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>("VND");
  const [iconKey, setIconKey] = useState("cash");
  const [feedback, setFeedback] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: () =>
      api.createWorkspace({
        name: workspaceName.trim(),
        kind: "personal",
        defaultCurrency: currency,
        initialAccount: {
          name: accountName.trim(),
          iconKey,
          kind: "cash",
          currency,
          openingBalanceMinorUnits: amount.trim() || "0",
        },
      }),
    onSuccess: async (result) => {
      selectWorkspace(result.workspace.id);
      await queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
      await retryBootstrap();
    },
    onError: (error: Error) => setFeedback(error.message),
  });

  function submit() {
    if (!workspaceName.trim() || !accountName.trim()) {
      setFeedback("Workspace and account names are required.");
      return;
    }
    if (!/^\d+$/.test(amount.trim() || "0")) {
      setFeedback("Initial amount must be a whole number.");
      return;
    }
    setFeedback(null);
    mutation.mutate();
  }

  return (
    <ScrollScreen>
      <Header
        eyebrow="WELCOME TO FINWISE"
        title="Create your workspace"
        subtitle="Start with one account. You can add more accounts and budgets later."
      />
      <Card>
        <TextField
          label="Workspace name"
          value={workspaceName}
          onChangeText={setWorkspaceName}
          placeholder="Personal finances"
          autoFocus
        />
        <TextField
          label="Default account name"
          value={accountName}
          onChangeText={setAccountName}
          placeholder="Cash"
        />
        <SelectField
          label="Account icon"
          value={iconKey}
          onChange={setIconKey}
          options={ACCOUNT_ICONS.map((icon) => ({
            label: `${icon.value === "cash" ? "▣" : "◉"} ${icon.label}`,
            value: icon.value,
          }))}
        />
        <SelectField
          label="Account currency"
          value={currency}
          onChange={(value) => setCurrency(value as CurrencyCode)}
          options={SUPPORTED_CURRENCIES.map((code) => ({
            label: code,
            value: code,
          }))}
        />
        <TextField
          label={`Initial cash amount (${currency} minor units)`}
          value={amount}
          onChangeText={setAmount}
          keyboardType="number-pad"
          placeholder="0"
        />
        {feedback ? <InlineError message={feedback} /> : null}
        <PrimaryButton
          label={mutation.isPending ? "Creating…" : "Create workspace"}
          disabled={mutation.isPending}
          onPress={submit}
        />
      </Card>
      <Card style={{ backgroundColor: colors.tealSoft }}>
        <Header
          eyebrow="DEFAULT SETUP"
          title="Budgets included"
          subtitle="Food, Shopping, Education, Transport, Housing, Health, Bills, and Other will be ready for this workspace."
        />
      </Card>
    </ScrollScreen>
  );
}
