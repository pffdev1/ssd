import { DimensionValue, View } from "react-native";

export function SkeletonBlock({
  height,
  width = "100%",
  radius = 12
}: {
  height: number;
  width?: DimensionValue;
  radius?: number;
}) {
  return (
    <View
      style={{
        height,
        width,
        borderRadius: radius,
        backgroundColor: "#e9f1fb"
      }}
    />
  );
}

export function ScreenSkeletonCard({ rows = 4 }: { rows?: number }) {
  return (
    <View
      style={{
        backgroundColor: "white",
        borderRadius: 30,
        borderWidth: 1,
        borderColor: "#bfd2e7",
        padding: 18,
        gap: 10
      }}
    >
      <SkeletonBlock height={14} width={180} />
      <SkeletonBlock height={30} width={260} />
      {Array.from({ length: rows }).map((_, index) => (
        <SkeletonBlock key={`skeleton-row-${index}`} height={54} />
      ))}
    </View>
  );
}
