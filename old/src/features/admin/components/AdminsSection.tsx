import { Pressable, Text, TextInput, View } from "react-native";
import { AdminUser } from "@/src/lib/types";

function Field({
  value,
  onChange,
  placeholder
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      style={{
        borderWidth: 1,
        borderColor: "#bfd2e7",
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: "#f9fbff"
      }}
    />
  );
}

type AdminsSectionProps = {
  busy: boolean;
  adminName: string;
  adminEmail: string;
  admins: AdminUser[];
  onAdminNameChange: (value: string) => void;
  onAdminEmailChange: (value: string) => void;
  onAddAdmin: () => void | Promise<void>;
};

export function AdminsSection({
  busy,
  adminName,
  adminEmail,
  admins,
  onAdminNameChange,
  onAdminEmailChange,
  onAddAdmin
}: AdminsSectionProps) {
  return (
    <View style={{ borderRadius: 24, borderWidth: 1, borderColor: "#bfd2e7", backgroundColor: "white", padding: 12, gap: 8 }}>
      <Field value={adminName} onChange={onAdminNameChange} placeholder="Nombre" />
      <Field value={adminEmail} onChange={onAdminEmailChange} placeholder="Correo" />
      <Pressable
        onPress={() => {
          void onAddAdmin();
        }}
        style={{
          alignSelf: "flex-start",
          borderRadius: 999,
          backgroundColor: busy ? "#94a3b8" : "#0b5ed7",
          paddingHorizontal: 12,
          paddingVertical: 9
        }}
      >
        <Text style={{ color: "white", fontWeight: "700" }}>Agregar administrador</Text>
      </Pressable>

      {admins.map((item) => (
        <View key={item.id} style={{ borderRadius: 16, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "#f9fbff", padding: 10 }}>
          <Text style={{ color: "#001534", fontWeight: "700" }}>{item.full_name}</Text>
          <Text style={{ color: "#475569", marginTop: 2 }}>{item.email}</Text>
        </View>
      ))}
    </View>
  );
}
