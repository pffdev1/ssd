import { Redirect, useLocalSearchParams } from "expo-router";

export default function LegacyRequestDetailAlias() {
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id) {
    return <Redirect href="/(tabs)/requests" />;
  }

  return <Redirect href={`/request/${id}`} />;
}