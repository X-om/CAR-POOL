import { TripDetailScreen } from "@/features/trips/screens/TripDetailScreen";

export default async function DriverTripDetailPage({
  params,
}: {
  params: { tripId: string };
}) {
  const { tripId } = await params;
  return <TripDetailScreen tripId={tripId} />;
}
