import { EditRideScreen } from "@/features/rides/screens/EditRideScreen";

export default async function DriverEditRidePage({
  params,
}: {
  params: { rideId: string };
}) {
  const { rideId } = await params;
  return <EditRideScreen rideId={rideId} />;
}
