import { DriverRideDetailScreen } from "@/features/rides/screens/DriverRideDetailScreen";

export default async function DriverRideDetailPage({
  params,
}: {
  params: { rideId: string };
}) {
  const { rideId } = await params;
  return <DriverRideDetailScreen rideId={rideId} />;
}
