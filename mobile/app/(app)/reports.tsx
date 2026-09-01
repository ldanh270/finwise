import { AppShell } from "../../src/ui/app-shell";
import {
  Card,
  Header,
  ScrollScreen,
  StatePanel,
} from "../../src/ui/components";

export default function ReportsRoute() {
  return (
    <AppShell active="reports">
      <ScrollScreen>
        <Header
          eyebrow="INSIGHTS"
          title="Reports"
          subtitle="Permission-filtered insights will follow your confirmed activity."
        />
        <Card>
          <StatePanel
            title="Reports are waiting for data"
            description="The web workspace exposes this same report surface while the reporting API is being finalized. Confirmed transactions remain available in Overview and Transactions."
          />
        </Card>
      </ScrollScreen>
    </AppShell>
  );
}
