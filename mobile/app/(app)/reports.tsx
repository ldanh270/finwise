import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Text, View } from "react-native";
import { AppShell } from "../../src/ui/app-shell";
import {
  Card,
  Header,
  Money,
  PrimaryButton,
  ScrollScreen,
  StatePanel,
  TextField,
  colors,
} from "../../src/ui/components";
import { useAuth } from "../../src/auth/auth-context";
import { useWorkspace } from "../../src/app/providers";
import { getReports } from "../../src/features/reports/reports-service";
import type { ReportsResponse } from "@finwise/api-client";

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function monthOffset(month: string, offset: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber - 1 + offset, 1))
    .toISOString()
    .slice(0, 7);
}

export default function ReportsRoute() {
  const { api } = useAuth();
  const { workspaceId } = useWorkspace();
  const end = currentMonth();
  const [fromInput, setFromInput] = useState(monthOffset(end, -5));
  const [toInput, setToInput] = useState(end);
  const [range, setRange] = useState({
    fromMonth: fromInput,
    toMonth: toInput,
  });
  const reportQuery = useQuery({
    queryKey: ["reports", workspaceId, range.fromMonth, range.toMonth],
    queryFn: () => getReports(api, workspaceId as string, range),
    enabled: Boolean(workspaceId),
  });

  return (
    <AppShell active="reports">
      <ScrollScreen>
        <Header
          eyebrow="INSIGHTS"
          title="Reports"
          subtitle="Permission-filtered insights from confirmed activity."
        />
        {!workspaceId ? (
          <StatePanel title="Choose a workspace to view reports." />
        ) : null}
        <Card>
          <View style={styles.filterGrid}>
            <TextField
              label="From month"
              value={fromInput}
              onChangeText={setFromInput}
              placeholder="2026-01"
            />
            <TextField
              label="To month"
              value={toInput}
              onChangeText={setToInput}
              placeholder="2026-06"
            />
          </View>
          <PrimaryButton
            label="Update report"
            onPress={() =>
              setRange({ fromMonth: fromInput.trim(), toMonth: toInput.trim() })
            }
            disabled={reportQuery.isFetching}
          />
        </Card>
        {reportQuery.isLoading ? <StatePanel title="Loading report…" /> : null}
        {reportQuery.isError ? (
          <StatePanel
            title="Reports are unavailable"
            description={
              reportQuery.error instanceof Error
                ? reportQuery.error.message
                : "Retry when the API is reachable."
            }
            action={{
              label: "Retry",
              onPress: () => void reportQuery.refetch(),
            }}
          />
        ) : null}
        {reportQuery.data ? <ReportContent report={reportQuery.data} /> : null}
      </ScrollScreen>
    </AppShell>
  );
}

function ReportContent({ report }: { report: ReportsResponse }) {
  const hasActivity = report.monthly.some(
    (row) => row.income.minorUnits !== "0" || row.spending.minorUnits !== "0",
  );
  return (
    <>
      {report.hasPartialAccess ? (
        <Text style={styles.notice}>
          Some account activity is excluded by your access scope.
        </Text>
      ) : null}
      <View style={styles.metricGrid}>
        <Metric label="Income" value={report.totals.income} />
        <Metric label="Spending" value={report.totals.spending} />
        <Metric label="Net" value={report.totals.net} />
      </View>
      <Card>
        <Text style={styles.cardTitle}>Monthly movement</Text>
        {!hasActivity ? (
          <Text style={styles.muted}>
            No confirmed income or spending in this range.
          </Text>
        ) : null}
        {hasActivity
          ? report.monthly.map((row) => (
              <View style={styles.row} key={row.month}>
                <Text style={styles.rowTitle}>{row.month}</Text>
                <View style={styles.rowValues}>
                  <Text style={styles.income}>
                    +<Money value={row.income} compact />
                  </Text>
                  <Text style={styles.expense}>
                    −<Money value={row.spending} compact />
                  </Text>
                  <Money value={row.net} compact />
                </View>
              </View>
            ))
          : null}
      </Card>
      <Card>
        <Text style={styles.cardTitle}>Spending by budget</Text>
        {report.budgets.length === 0 ? (
          <Text style={styles.muted}>
            Assign a budget to a transaction to see budget movement.
          </Text>
        ) : (
          report.budgets.map((budget) => (
            <View style={styles.row} key={budget.budgetId ?? "unassigned"}>
              <View>
                <Text style={styles.rowTitle}>{budget.name}</Text>
                <Text style={styles.muted}>
                  Net <Money value={budget.net} compact />
                </Text>
              </View>
              <Money value={budget.spending} compact />
            </View>
          ))
        )}
      </Card>
    </>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: ReportsResponse["totals"]["income"];
}) {
  return (
    <Card style={styles.metric}>
      <Text style={styles.muted}>{label}</Text>
      <Money value={value} compact />
    </Card>
  );
}

const styles = {
  filterGrid: { gap: 10 } as const,
  metricGrid: { gap: 10 } as const,
  metric: { flex: 1 } as const,
  cardTitle: { color: colors.ink, fontSize: 16, fontWeight: "700" } as const,
  notice: { color: colors.amber, fontSize: 12, lineHeight: 18 } as const,
  muted: { color: colors.muted, fontSize: 12, lineHeight: 18 } as const,
  row: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  } as const,
  rowTitle: { color: colors.ink, fontSize: 13, fontWeight: "700" } as const,
  rowValues: { alignItems: "flex-end", gap: 4 } as const,
  income: {
    color: colors.teal,
    flexDirection: "row",
    alignItems: "center",
  } as const,
  expense: {
    color: colors.danger,
    flexDirection: "row",
    alignItems: "center",
  } as const,
};
