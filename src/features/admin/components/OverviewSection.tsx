import { Pressable, Text, View } from "react-native";

type OverviewSectionProps = {
  routeCount: number;
  departmentCount: number;
  requestTypeCount: number;
  adminCount: number;
  approvedLinesCount: number;
  onOpenWorkflows: () => void;
  onOpenCatalogs: () => void;
};

function MetricCard({
  title,
  value,
  actionLabel,
  onActionPress,
  subtitle
}: {
  title: string;
  value: number;
  actionLabel?: string;
  onActionPress?: () => void;
  subtitle?: string;
}) {
  return (
    <View
      style={{
        minWidth: 200,
        flex: 1,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "#d7e4f2",
        backgroundColor: "white",
        padding: 12
      }}
    >
      <Text style={{ color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2 }}>{title}</Text>
      <Text style={{ marginTop: 4, color: "#001534", fontSize: 34, fontWeight: "700" }}>{value}</Text>
      {subtitle ? <Text style={{ marginTop: 2, color: "#1e3a5f" }}>{subtitle}</Text> : null}
      {actionLabel && onActionPress ? (
        <Pressable onPress={onActionPress} style={{ marginTop: 6 }}>
          <Text style={{ color: "#1e3a5f", fontWeight: "700" }}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function OverviewSection({
  routeCount,
  departmentCount,
  requestTypeCount,
  adminCount,
  approvedLinesCount,
  onOpenWorkflows,
  onOpenCatalogs
}: OverviewSectionProps) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      <MetricCard title="Rutas" value={routeCount} actionLabel="Ver workflows" onActionPress={onOpenWorkflows} />
      <MetricCard
        title="Departamentos"
        value={departmentCount}
        actionLabel="Ir a catalogos"
        onActionPress={onOpenCatalogs}
      />
      <MetricCard
        title="Solicitudes"
        value={requestTypeCount}
        actionLabel="Gestionar"
        onActionPress={onOpenCatalogs}
      />
      <MetricCard title="Control" value={adminCount} subtitle={`${approvedLinesCount} lineas GG`} />
    </View>
  );
}
