import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

export default function BudgetsRoute() {
  const { api } = useAuth();
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const periodsQuery = useQuery({
    queryKey: ["budget-periods", workspaceId],
    queryFn: () => api.getBudgetPeriods(workspaceId as string),
    enabled: Boolean(workspaceId),
  });
  const categoriesQuery = useQuery({
    queryKey: ["categories", workspaceId],
    queryFn: () => api.getCategories(workspaceId as string),
    enabled: Boolean(workspaceId),
  });
  const tagsQuery = useQuery({
    queryKey: ["tags", workspaceId],
    queryFn: () => api.getTags(workspaceId as string),
    enabled: Boolean(workspaceId),
  });
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const month = selectedMonth || periodsQuery.data?.[0]?.month || "";
  useEffect(() => {
    if (!periodsQuery.data?.length) {
      if (selectedMonth) setSelectedMonth("");
      return;
    }
    if (
      selectedMonth &&
      periodsQuery.data.some((period) => period.month === selectedMonth)
    ) {
      return;
    }
    setSelectedMonth(periodsQuery.data[0]?.month ?? "");
  }, [periodsQuery.data, selectedMonth]);
  const overviewQuery = useQuery({
    queryKey: ["budget-overview", workspaceId, month],
    queryFn: () => api.getBudgetOverview(workspaceId as string, month),
    enabled: Boolean(workspaceId && month),
  });
  const [newMonth, setNewMonth] = useState(todayMonth());
  const [base, setBase] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [parentCategoryId, setParentCategoryId] = useState("");
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
      api.createBudgetPeriod(workspaceId as string, {
        month: newMonth.trim(),
        baseMinorUnits: base.trim(),
        constraints: categoryId
          ? [
              {
                categoryId,
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
  const createCategoryMutation = useMutation({
    mutationFn: () =>
      api.createCategory(workspaceId as string, {
        name: categoryName.trim(),
        ...(parentCategoryId ? { parentId: parentCategoryId } : {}),
      }),
    onSuccess: async () => {
      setCategoryName("");
      setParentCategoryId("");
      await queryClient.invalidateQueries({
        queryKey: ["categories", workspaceId],
      });
    },
    onError: (error: Error) => setFeedback(error.message),
  });
  const createTagMutation = useMutation({
    mutationFn: () =>
      api.createTag(workspaceId as string, { name: tagName.trim() }),
    onSuccess: async () => {
      setTagName("");
      await queryClient.invalidateQueries({ queryKey: ["tags", workspaceId] });
    },
    onError: (error: Error) => setFeedback(error.message),
  });
  const closeMutation = useMutation({
    mutationFn: () => api.closeBudgetPeriod(workspaceId as string, month),
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
  function createBudget() {
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
    <AppShell active="budgets">
      <ScrollScreen>
        <Header
          eyebrow="PLANNING"
          title="Budgets"
          subtitle="Plan spending separately from confirmed cash balances."
        />
        {periodsQuery.isPending ? (
          <StatePanel title="Loading budget plans…" />
        ) : periodsQuery.isError ? (
          <StatePanel
            title="Budgets could not load"
            action={{
              label: "Retry",
              onPress: () => void periodsQuery.refetch(),
            }}
          />
        ) : (
          <>
            <Card>
              <Header eyebrow="CLASSIFICATION" title="Categories & tags" />
              <TextField
                label="New category"
                value={categoryName}
                onChangeText={setCategoryName}
                placeholder="Food"
              />
              {categoriesQuery.data?.length ? (
                <SelectField
                  label="Parent (optional)"
                  value={parentCategoryId}
                  onChange={setParentCategoryId}
                  options={[
                    { label: "Root category", value: "" },
                    ...categoriesQuery.data
                      .filter((category) => !category.parentId)
                      .map((category) => ({
                        label: category.name,
                        value: category.id,
                      })),
                  ]}
                />
              ) : null}
              <PrimaryButton
                label="Create category"
                disabled={
                  createCategoryMutation.isPending || !categoryName.trim()
                }
                onPress={() => createCategoryMutation.mutate()}
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
                {categoriesQuery.data?.length ?? 0} categories ·{" "}
                {tagsQuery.data?.length ?? 0} tags
              </Text>
              {categoriesQuery.isError ? (
                <InlineError message="Categories could not load. Retry before creating a budget constraint." />
              ) : null}
              {tagsQuery.isError ? (
                <InlineError message="Tags could not load. Retry before applying classifications." />
              ) : null}
              {(categoriesQuery.data ?? []).map((category) => (
                <View key={category.id} style={{ gap: 3 }}>
                  <Text style={{ color: colors.ink, fontWeight: "700" }}>
                    {category.parentId ? "↳ " : ""}
                    {category.name}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {category.status}
                  </Text>
                  <Divider />
                </View>
              ))}
              {(tagsQuery.data ?? []).map((tag) => (
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
              {categoriesQuery.data?.length ? (
                <SelectField
                  label="Optional category pool"
                  value={categoryId}
                  onChange={setCategoryId}
                  options={[
                    { label: "No category", value: "" },
                    ...categoriesQuery.data.map((category) => ({
                      label: category.name,
                      value: category.id,
                    })),
                  ]}
                />
              ) : null}
              {categoryId ? (
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
                onPress={createBudget}
              />
              {feedback ? <InlineError message={feedback} /> : null}
            </Card>
            {periodsQuery.data?.length ? (
              <Card>
                <Header eyebrow="PLANS" title="Budget periods" />
                <SelectField
                  label="Selected month"
                  value={month}
                  onChange={setSelectedMonth}
                  options={periodsQuery.data.map((period) => ({
                    label: `${period.month} · ${period.status}`,
                    value: period.month,
                  }))}
                />
                {overviewQuery.isPending ? (
                  <Text style={{ color: colors.muted }}>
                    Loading allocation…
                  </Text>
                ) : overviewQuery.isError ? (
                  <InlineError message="This month's details are unavailable." />
                ) : overviewQuery.data ? (
                  <>
                    <View style={styles.totals}>
                      <Metric
                        label="Allocated"
                        value={overviewQuery.data.totals.allocated}
                      />
                      <Metric
                        label="Actual"
                        value={overviewQuery.data.totals.actual}
                      />
                      <Metric
                        label="Remaining"
                        value={overviewQuery.data.totals.remaining}
                      />
                    </View>
                    <Divider />
                    {overviewQuery.data.constraints.map((constraint) => (
                      <View key={constraint.categoryId} style={{ gap: 5 }}>
                        <Text style={{ color: colors.ink, fontWeight: "700" }}>
                          {categoriesQuery.data?.find(
                            (category) => category.id === constraint.categoryId,
                          )?.name ?? "Category"}
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
                        closeMutation.isPending ||
                        overviewQuery.data.status !== "open"
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
