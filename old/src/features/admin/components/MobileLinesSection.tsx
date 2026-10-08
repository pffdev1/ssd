import { Pressable, Text, View } from "react-native";
import { RequestItem } from "@/src/lib/types";
import { parseBeneficiaries } from "@/src/lib/beneficiaries";

type MobileLinesSectionProps = {
  lines: RequestItem[];
  onOpenResponsiva: (requestId: string, beneficiary: string) => void;
  onOpenRequest: (requestId: string) => void;
};

export function MobileLinesSection({
  lines,
  onOpenResponsiva,
  onOpenRequest
}: MobileLinesSectionProps) {
  function getBeneficiaries(request: RequestItem) {
    const parsed = parseBeneficiaries(request.payload);
    if (parsed.length > 0) {
      return parsed;
    }
    return request.beneficiary_name ? [request.beneficiary_name] : [];
  }

  return (
    <View style={{ borderRadius: 24, borderWidth: 1, borderColor: "#bfd2e7", backgroundColor: "white", padding: 12, gap: 8 }}>
      {lines.length === 0 ? <Text style={{ color: "#475569" }}>No hay lineas aprobadas por GG.</Text> : null}
      {lines.map((request) => {
        const beneficiaries = getBeneficiaries(request);
        return (
          <View key={request.id} style={{ borderRadius: 18, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "#f9fbff", padding: 10 }}>
            <Text style={{ color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2 }}>{request.ticket_code}</Text>
            <Text style={{ marginTop: 2, color: "#001534", fontWeight: "700" }}>{request.subject}</Text>
            <Text style={{ marginTop: 3, color: "#1e3a5f" }}>{request.requester_name} | {request.department}</Text>
            <View style={{ marginTop: 6, gap: 6 }}>
              {beneficiaries.map((beneficiary, index) => (
                <View key={`${request.id}-${beneficiary}-${index}`} style={{ borderRadius: 14, borderWidth: 1, borderColor: "#d7e4f2", backgroundColor: "white", padding: 8 }}>
                  <Text style={{ color: "#001534", fontWeight: "700" }}>{beneficiary}</Text>
                  <View style={{ marginTop: 6, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    <Pressable
                      onPress={() => onOpenResponsiva(request.id, beneficiary)}
                      style={{ borderRadius: 999, backgroundColor: "#0b5ed7", paddingHorizontal: 10, paddingVertical: 7 }}
                    >
                      <Text style={{ color: "white", fontWeight: "700", fontSize: 12 }}>Carta responsiva</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => onOpenRequest(request.id)}
                      style={{ borderRadius: 999, borderWidth: 1, borderColor: "#bfd2e7", backgroundColor: "white", paddingHorizontal: 10, paddingVertical: 7 }}
                    >
                      <Text style={{ color: "#1e3a5f", fontWeight: "700", fontSize: 12 }}>Ver solicitud</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}
