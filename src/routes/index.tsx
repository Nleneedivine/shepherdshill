import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Activity,
  BarChart3,
  LayoutDashboard,
  Settings,
  Users,
  Zap,
} from "lucide-react";
import {
  AppLayout,
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  Input,
  Modal,
  PageWrapper,
  Select,
  Spinner,
  StatCard,
  Textarea,
} from "@/components/ds";
import { useToast } from "@/hooks/useToast";

export const Route = createFileRoute("/")({
  component: Index,
});

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, active: true },
  { label: "Analytics", icon: BarChart3 },
  { label: "Users", icon: Users },
  { label: "Activity", icon: Activity },
  { label: "Settings", icon: Settings },
];

interface Row {
  id: string;
  name: string;
  role: string;
  status: "active" | "invited" | "paused";
}

const rows: Row[] = [
  { id: "1", name: "Ava Chen", role: "Admin", status: "active" },
  { id: "2", name: "Marcus Lee", role: "Editor", status: "active" },
  { id: "3", name: "Priya Shah", role: "Viewer", status: "invited" },
  { id: "4", name: "Diego Alvarez", role: "Editor", status: "paused" },
];

function Index() {
  const { showToast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [page, setPage] = useState(1);

  return (
    <AppLayout
      navItems={navItems}
      userProfile={{ name: "Ava Chen", email: "ava@console.dev" }}
      title="Design System"
      breadcrumb={[{ label: "Console" }, { label: "Design System" }]}
      notificationCount={3}
    >
      <PageWrapper className="space-y-8">
        {/* Stats */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Revenue" value={48250} prefix="$" trend={12.4} trendLabel="vs last month" icon={<Zap size={18} />} glowColor="purple" />
          <StatCard label="Users" value={12840} trend={4.2} trendLabel="this week" icon={<Users size={18} />} glowColor="green" />
          <StatCard label="Active Sessions" value={342} trend={-2.1} trendLabel="last hour" icon={<Activity size={18} />} glowColor="amber" />
          <StatCard label="Errors" value={7} trend={-38} trendLabel="past 24h" icon={<BarChart3 size={18} />} glowColor="red" />
        </section>

        {/* Buttons & Badges */}
        <Card title="Buttons & Badges" subtitle="Variants and sizes">
          <div className="flex flex-wrap gap-3">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="primary" loading>Loading</Button>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <Badge variant="success" dot>Live</Badge>
            <Badge variant="warning">Pending</Badge>
            <Badge variant="danger">Error</Badge>
            <Badge variant="info">Info</Badge>
            <Badge variant="purple">Beta</Badge>
            <Badge variant="neutral">Draft</Badge>
          </div>
        </Card>

        {/* Forms */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card title="Form Fields">
            <div className="space-y-4">
              <Input label="Email" placeholder="you@example.com" hint="We'll never share it." required />
              <Select label="Plan" defaultValue="pro">
                <option value="free">Free</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </Select>
              <Textarea label="Notes" placeholder="Optional context…" />
            </div>
          </Card>

          <Card title="Feedback">
            <div className="flex items-center gap-4">
              <Spinner size="sm" />
              <Spinner size="md" color="white" />
              <Spinner size="lg" color="green" />
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => showToast("Saved successfully", "success")}>Success toast</Button>
              <Button variant="secondary" onClick={() => showToast("Something went wrong", "error")}>Error toast</Button>
              <Button variant="secondary" onClick={() => setModalOpen(true)}>Open modal</Button>
            </div>
          </Card>
        </div>

        {/* Table */}
        <Card title="Team members" subtitle="Recent activity across your workspace">
          <DataTable<Row>
            columns={[
              { key: "name", header: "Name" },
              { key: "role", header: "Role" },
              {
                key: "status",
                header: "Status",
                render: (r) => (
                  <Badge
                    variant={r.status === "active" ? "success" : r.status === "invited" ? "info" : "warning"}
                    dot={r.status === "active"}
                  >
                    {r.status}
                  </Badge>
                ),
              },
            ]}
            data={rows}
            rowKey={(r) => r.id}
            pagination={{ page, pageSize: 10, total: 4 }}
            onPageChange={setPage}
          />
        </Card>

        {/* Empty state */}
        <Card>
          <EmptyState
            icon={<Activity />}
            title="No activity yet"
            description="Once your team starts working, updates will appear here."
            actionLabel="Invite teammates"
            action={() => showToast("Invites sent", "info")}
          />
        </Card>
      </PageWrapper>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Confirm action"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                setModalOpen(false);
                showToast("Action confirmed", "success");
              }}
            >
              Confirm
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-300">
          This is a sample modal built on the design system. It closes on Escape or backdrop click.
        </p>
      </Modal>
    </AppLayout>
  );
}
