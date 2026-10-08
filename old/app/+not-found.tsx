import { Link } from "expo-router";
import { Text, View } from "react-native";

export default function NotFoundScreen() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        backgroundColor: "#dbe7f5"
      }}
    >
      <View
        style={{
          width: "100%",
          maxWidth: 560,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: "#bfd2e7",
          backgroundColor: "white",
          padding: 20,
          gap: 10
        }}
      >
        <Text style={{ color: "#1f406b", fontSize: 11, letterSpacing: 2, textTransform: "uppercase" }}>
          SSD
        </Text>
        <Text style={{ color: "#001534", fontSize: 28, fontWeight: "700" }}>Ruta no encontrada</Text>
        <Text style={{ color: "#475569", lineHeight: 22 }}>
          El enlace solicitado no existe o ya no esta disponible.
        </Text>

        <Link href="/home" style={{ color: "#0b5ed7", fontWeight: "700" }}>
          Ir al home
        </Link>
        <Link href="/login" style={{ color: "#1e3a5f", fontWeight: "700" }}>
          Ir al login
        </Link>
      </View>
    </View>
  );
}
