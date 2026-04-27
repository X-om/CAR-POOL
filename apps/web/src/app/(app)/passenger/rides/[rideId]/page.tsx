import { RideDetailScreen } from "@/features/search/screens/RideDetailScreen";

export default async function RideDetailPage({
  params,
}: {
  params: { rideId: string };
}) {
  const { rideId } = await params;
  return <RideDetailScreen rideId={rideId} />;
}
