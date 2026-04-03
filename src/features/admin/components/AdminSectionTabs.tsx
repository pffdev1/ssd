import { Pressable, Text, View } from "react-native";
import { AdminSection } from "@/src/features/admin/lib/config";

function Tab({
  active,
  label,
  onPress
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered, pressed }) => ({
        borderWidth: 1,
        borderColor: active ? "#0b5ed7" : "#d7e4f2",
        backgroundColor: active ? "#0b5ed7" : pressed ? "#eef6ff" : hovered ? "#f8fbff" : "white",
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 9
      })}
    >
      <Text style={{ color: active ? "white" : "#1e293b", fontWeight: "700", fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
}

type AdminSectionTabsProps = {
  section: AdminSection;
  onChange: (section: AdminSection) => void;
};

export function AdminSectionTabs({ section, onChange }: AdminSectionTabsProps) {
  return (
    <View style={{ marginTop: 9, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      <Tab active={section === "overview"} label="Resumen" onPress={() => onChange("overview")} />
      <Tab active={section === "steps"} label="Pasos" onPress={() => onChange("steps")} />
      <Tab active={section === "workflows"} label="Workflows" onPress={() => onChange("workflows")} />
      <Tab active={section === "catalogs"} label="Catalogos" onPress={() => onChange("catalogs")} />
      <Tab active={section === "admins"} label="Administradores" onPress={() => onChange("admins")} />
      <Tab active={section === "mobile"} label="Lineas" onPress={() => onChange("mobile")} />
    </View>
  );
}
