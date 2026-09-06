import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  BudgetPeriodSummary,
  BudgetSummary,
  TagSummary,
} from "@finwise/api-client";
import { Text, View } from "react-native";
import { AppShell } from "../../src/ui/app-shell";
import {
  Card,
  Divider,
  Header,
  InlineError,
  Money,
  PrimaryButton,
  ScrollScreen,
  SecondaryButton,
  SelectField,
  StatePanel,
  TextField,
  colors,
} from "../../src/ui/components";
import { useAuth } from "../../src/auth/auth-context";
import { useWorkspace } from "../../src/app/providers";
import {
  closeBudgetPeriod,
  createBudgetPeriod,
  createBudget,
  createTag,
  getBudgetOverview,
  getBudgetPeriods,
  listBudgets,
  getTags,
} from "../../src/features/planning/budget-service";
import {
  WorkspaceCache,
  type BudgetOverviewCache,
} from "../../src/cache/workspace-cache";

export default function BudgetsRoute() {
  const { api, session } = useAuth();
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const periodsQuery = useQuery({
    queryKey: ["budget-periods", workspaceId],
    queryFn: () => getBudgetPeriods(api, workspaceId as string),
    enabled: Boolean(workspaceId),
  });
  const budgetsQuery = useQuery({
    queryKey: ["budgets", workspaceId],
    queryFn: () => listBudgets(api, workspaceId as string),
    enabled: Boolean(workspaceId),
  });
  const tagsQuery = useQuery({
    queryKey: ["tags", workspaceId],
    queryFn: () => getTags(api, workspaceId as string),
    enabled: Boolean(workspaceId),
  });
  const cache = useMemo(() => {
    if (!session?.user.id || !workspaceId) return null;
    return new WorkspaceCache(session.user.id, workspaceId);
  }, [session?.user.id, workspaceId]);
  const [cachedBudget, setCachedBudget] = useState<{
    readonly savedAt: string;
    readonly periods: readonly BudgetPeriodSummary[];
    readonly budgets: readonly BudgetSummary[];
    readonly tags: readonly TagSummary[];
    readonly overviews: readonly BudgetOverviewCache[];
  } | null>(null);
  useEffect(() => {
    // Reset the previous workspace's budget snapshot before reading the new partition.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCachedBudget(null);
    if (!cache) return;
    let active = true;
    void cache.read().then((snapshot) => {
      if (!active || !snapshot) return;
      setCachedBudget({
        savedAt: snapshot.savedAt,
        periods: snapshot.budgetPeriods ?? [],
        budgets: snapshot.budgets ?? [],
        tags: snapshot.tags ?? [],
        overviews: snapshot.budgetOverviews ?? [],
      });
    });
    return () => {
      active = false;
    };
  }, [cache]);
  const periods = periodsQuery.data ?? cachedBudget?.periods ?? [];
  const budgets = budgetsQuery.data ?? cachedBudget?.budgets ?? [];
  const tags = tagsQuery.data ?? cachedBudget?.tags ?? [];
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const month = selectedMonth || periods[0]?.month || "";
  useEffect(() => {
    if (!periods.length) {
      if (selectedMonth) setSelectedMonth("");
      return;
    }
    if (
      selectedMonth &&
      periods.some((period) => period.month === selectedMonth)
    ) {
      return;
    }
    setSelectedMonth(periods[0]?.month ?? "");
  }, [periods, selectedMonth]);
  const overviewQuery = useQuery({
    queryKey: ["budget-overview", workspaceId, month],
    queryFn: () => getBudgetOverview(api, workspaceId as string, month),
    enabled: Boolean(workspaceId && month),
  });
  const cachedOverview = cachedBudget?.overviews.find(
    (overview) => overview.month === month,
  )?.value;
  const overview = overviewQuery.data ?? cachedOverview;
  useEffect(() => {
    if (!cache) return;
    if (
      periodsQuery.data === undefined &&
      budgetsQuery.data === undefined &&
      tagsQuery.data === undefined &&
      overviewQuery.data === undefined
    ) {
      return;
    }
    void cache.write({
      ...(periodsQuery.data ? { budgetPeriods: periodsQuery.data } : {}),
      ...(budgetsQuery.data ? { budgets: budgetsQuery.data } : {}),
      ...(tagsQuery.data ? { tags: tagsQuery.data } : {}),
      ...(overviewQuery.data && month
        ? { budgetOverviews: [{ month, value: overviewQuery.data }] }
        : {}),
    });
  }, [
    cache,
    budgetsQuery.data,
    month,
    overviewQuery.data,
    periodsQuery.data,
    tagsQuery.data,
  ]);
  const [newMonth, setNewMonth] = useState(todayMonth());
  const [base, setBase] = useState("");
  const [budgetId, setBudgetId] = useState("");
  const [budgetName, setBudgetName] = useState("");
  const [parentBudgetId, setParentBudgetId] = useState("");
  const [tagName, setTagName] = useState("");
  const [mode, setMode] = useState<"BY_CHILDREN" | "SHARED_POOL" | "HYBRID">(
    "SHARED_POOL",
  );
  const [fixedMinorUnits, setFixedMinorUnits] = useState("");
  const [percentageBasisPoints, setPercentageBasisPoints] = useState("0");
  const [rolloverMode, setRolloverMode] = useState<
    "NONE" | "POSITIVE_ONLY" | "FULL_BALANCE"
  >("NONE");
  const [feedback, setFeedback] = useState<string | null>(null);
  const createMutation = useMutation({
    mutationFn: () =>
      createBudgetPeriod(api, workspaceId as string, {
        month: newMonth.trim(),
        baseMinorUnits: base.trim(),
        constraints: budgetId
          ? [
              {
                budgetId,
                mode,
                fixedMinorUnits: fixedMinorUnits.trim() || "0",
                percentageBasisPoints: Number(percentageBasisPoints),
                rolloverMode,
              },
            ]
          : [],
      }),
    onSuccess: async () => {
      setFeedback("Budget plan created.");
      await queryClient.invalidateQueries({
        queryKey: ["budget-periods", workspaceId],
      });
    },
    onError: (error: Error) => setFeedback(error.message),
  });
  const createBudgetBucketMutation = useMutation({
    mutationFn: () =>
      createBudget(api, workspaceId as string, {
        name: budgetName.trim(),
        ...(parentBudgetId ? { parentId: parentBudgetId } : {}),
      }),
    onSuccess: async () => {
      setBudgetName("");
      setParentBudgetId("");
      await queryClient.invalidateQueries({
        queryKey: ["budgets", workspaceId],
      });
    },
    onError: (error: Error) => setFeedback(error.message),
  });
  const createTagMutation = useMutation({
    mutationFn: () =>
      createTag(api, workspaceId as string, { name: tagName.trim() }),
    onSuccess: async () => {
      setTagName("");
      await queryClient.invalidateQueries({ queryKey: ["tags", workspaceId] });
    },
    onError: (error: Error) => setFeedback(error.message),
  });
  const closeMutation = useMutation({
    mutationFn: () => closeBudgetPeriod(api, workspaceId as string, month),
    onSuccess: async () => {
      setFeedback("Budget period closed.");
      await queryClient.invalidateQueries({
        queryKey: ["budget-periods", workspaceId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["budget-overview", workspaceId, month],
      });
    },
    onError: (error: Error) => setFeedback(error.message),
  });
  function createMonthlyBudget() {
    if (
      !workspaceId ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(newMonth.trim()) ||
      !/^\d+$/.test(base.trim()) ||
      (fixedMinorUnits.trim() !== "" &&
        !/^\d+$/.test(fixedMinorUnits.trim())) ||
      !/^\d+$/.test(percentageBasisPoints.trim()) ||
      Number(percentageBasisPoints.trim()) > 10000
    ) {
      setFeedback("Use an ISO month and a non-negative VND minor-unit base.");
      return;
    }
    createMutation.mutate();
  }
  return (
    <AppShell active="other">
      <ScrollScreen>
        <Header
          eyebrow="PLANNING"
          title="Budgets"
          subtitle="Plan spending separately from confirmed cash balances."
        />
        {periodsQuery.isPending && periods.length === 0 ? (
          <StatePanel title="Loading budget plans…" />
        ) : periodsQuery.isError && periods.length === 0 ? (
          <StatePanel
            title="Budgets could not load"
            action={{
              label: "Retry",
              onPress: () => void periodsQuery.refetch(),
            }}
          />
        ) : (
          <>
            {periodsQuery.isError ? (
              <InlineError message="Showing cached budget plans. Retry when the connection is restored." />
            ) : null}
            <Card>
              <Header eyebrow="PLANNING" title="Budgets & tags" />
              <TextField
                label="New budget"
                value={budgetName}
                onChangeText={setBudgetName}
                placeholder="Food"
              />
              {budgets.length ? (
                <SelectField
                  label="Parent (optional)"
                  value={parentBudgetId}
                  onChange={setParentBudgetId}
                  options={[
                    { label: "Root budget", value: "" },
                    ...budgets
                      .filter((budget) => !budget.parentId)
                      .map((budget) => ({
                        label: budget.name,
                        value: budget.id,
                      })),
                  ]}
                />
              ) : null}
              <PrimaryButton
                label="Create budget"
                disabled={
                  createBudgetBucketMutation.isPending || !budgetName.trim()
                }
                onPress={() => createBudgetBucketMutation.mutate()}
              />
              <TextField
                label="New tag"
                value={tagName}
                onChangeText={setTagName}
                placeholder="Reimbursable"
              />
              <PrimaryButton
                label="Create tag"
                disabled={createTagMutation.isPending || !tagName.trim()}
                onPress={() => createTagMutation.mutate()}
              />
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {budgets.length} budgets · {tags.length} tags
              </Text>
              {budgetsQuery.isError ? (
                <InlineError message="Budgets could not load. Retry before creating a budget constraint." />
              ) : null}
              {tagsQuery.isError ? (
                <InlineError message="Tags could not load. Retry before applying classifications." />
              ) : null}
              {budgets.map((budget) => (
                <View key={budget.id} style={{ gap: 3 }}>
                  <Text style={{ color: colors.ink, fontWeight: "700" }}>
                    {budget.parentId ? "↳ " : ""}
                    {budget.name}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {budget.status}
                  </Text>
                  <Divider />
                </View>
              ))}
              {tags.map((tag) => (
                <Text key={tag.id} style={{ color: colors.teal, fontSize: 12 }}>
                  #{tag.name}
                </Text>
              ))}
            </Card>
            <Card>
              <Header eyebrow="NEW PLAN" title="Create a monthly plan" />
              <TextField
                label="Month (YYYY-MM)"
                value={newMonth}
                onChangeText={setNewMonth}
                placeholder="2026-09"
              />
              <TextField
                label="Base (VND minor units)"
                value={base}
                onChangeText={setBase}
                keyboardType="number-pad"
                placeholder="5000000"
              />
              {budgets.length ? (
                <SelectField
                  label="Optional budget pool"
                  value={budgetId}
                  onChange={setBudgetId}
                  options={[
                    { label: "No budget", value: "" },
                    ...budgets.map((budget) => ({
                      label: budget.name,
                      value: budget.id,
                    })),
                  ]}
                />
              ) : null}
              {budgetId ? (
                <>
                  <SelectField
                    label="Allocation mode"
                    value={mode}
                    onChange={(value) => setMode(value as typeof mode)}
                    options={[
                      { label: "Shared pool", value: "SHARED_POOL" },
                      { label: "By children", value: "BY_CHILDREN" },
                      { label: "Hybrid", value: "HYBRID" },
                    ]}
                  />
                  <TextField
                    label="Fixed (VND minor units)"
                    value={fixedMinorUnits}
                    onChangeText={setFixedMinorUnits}
                    keyboardType="number-pad"
                    placeholder="0"
                  />
                  <TextField
                    label="Percentage (basis points)"
                    value={percentageBasisPoints}
                    onChangeText={setPercentageBasisPoints}
                    keyboardType="number-pad"
                    placeholder="0"
                  />
                  <SelectField
                    label="Rollover"
                    value={rolloverMode}
                    onChange={(value) =>
                      setRolloverMode(value as typeof rolloverMode)
                    }
                    options={[
                      { label: "None", value: "NONE" },
                      { label: "Positive only", value: "POSITIVE_ONLY" },
                      { label: "Full balance", value: "FULL_BALANCE" },
                    ]}
                  />
                </>
              ) : null}
              <PrimaryButton
                label={createMutation.isPending ? "Creating…" : "Create budget"}
                disabled={createMutation.isPending}
                onPress={createMonthlyBudget}
              />
              {feedback ? <InlineError message={feedback} /> : null}
            </Card>
            {periods.length ? (
              <Card>
                <Header eyebrow="PLANS" title="Budget periods" />
                <SelectField
                  label="Selected month"
                  value={month}
                  onChange={setSelectedMonth}
                  options={periods.map((period) => ({
                    label: `${period.month} · ${period.status}`,
                    value: period.month,
                  }))}
                />
                {overviewQuery.isPending && !overview ? (
                  <Text style={{ color: colors.muted }}>
                    Loading allocation…
                  </Text>
                ) : overviewQuery.isError && !overview ? (
                  <InlineError message="This month's details are unavailable." />
                ) : overview ? (
                  <>
                    {overviewQuery.isError ? (
                      <InlineError message="Showing the cached allocation for this month." />
                    ) : null}
                    <View style={styles.totals}>
                      <Metric
                        label="Allocated"
                        value={overview.totals.allocated}
                      />
                      <Metric label="Actual" value={overview.totals.actual} />
                      <Metric
                        label="Remaining"
                        value={overview.totals.remaining}
                      />
                    </View>
                    <Divider />
                    {overview.constraints.map((constraint) => (
                      <View key={constraint.budgetId} style={{ gap: 5 }}>
                        <Text style={{ color: colors.ink, fontWeight: "700" }}>
                          {budgets.find(
                            (budget) => budget.id === constraint.budgetId,
                          )?.name ?? "Budget"}
                        </Text>
                        <Text style={{ color: colors.muted, fontSize: 12 }}>
                          {constraint.mode} · {constraint.rolloverMode}
                        </Text>
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                          }}
                        >
                          <Text style={{ color: colors.muted }}>Remaining</Text>
                          <Money value={constraint.remaining} compact />
                        </View>
                        <Divider />
                      </View>
                    ))}
                    <SecondaryButton
                      label={
                        closeMutation.isPending
                          ? "Closing…"
                          : "Close budget period"
                      }
                      disabled={
                        closeMutation.isPending || overview.status !== "open"
                      }
                      onPress={() => closeMutation.mutate()}
                    />
                  </>
                ) : (
                  <Text style={{ color: colors.muted }}>
                    No detail for this month.
                  </Text>
                )}
              </Card>
            ) : (
              <StatePanel
                title="No budget periods yet"
                description="Create a monthly plan to see allocation and actual spending."
              />
            )}
          </>
        )}
      </ScrollScreen>
    </AppShell>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: import("@finwise/api-client").MoneyDto;
}) {
  return (
    <View>
      <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
      <Money value={value} compact />
    </View>
  );
}
function todayMonth(): string {
  return new Date().toISOString().slice(0, 7);
}
const styles = {
  totals: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
  },
};
