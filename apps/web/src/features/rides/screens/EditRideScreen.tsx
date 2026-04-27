"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getDriverRide, updateRide } from "@/features/rides/api/ridesApi";
import { listVehicles } from "@/features/vehicles/api/vehiclesApi";
import { toDatetimeLocalValue } from "@/lib/format/date";
import { queryKeys } from "@/lib/query/keys";

const EditSchema = z.object({
  vehicleId: z.string().min(1, "Vehicle is required"),
  sourceCity: z.string().min(1, "Source city is required"),
  destinationCity: z.string().min(1, "Destination city is required"),
  departureTimeLocal: z.string().min(1, "Departure time is required"),
  pricePerSeat: z.coerce.number().nonnegative(),
  approvalMode: z.enum(["AUTO", "MANUAL"]).default("AUTO"),
});

type EditFormInput = z.input<typeof EditSchema>;
type EditValues = z.output<typeof EditSchema>;

type StopDraft = {
  stopOrder: number;
  cityName: string;
  latitude: number;
  longitude: number;
};

export function EditRideScreen({ rideId }: { rideId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const vehiclesQuery = useQuery({
    queryKey: queryKeys.vehicles,
    queryFn: listVehicles,
  });

  const rideQuery = useQuery({
    queryKey: queryKeys.ride(rideId),
    queryFn: () => getDriverRide(rideId),
  });

  const [stops, setStops] = React.useState<StopDraft[]>([]);

  const form = useForm<EditFormInput>({
    resolver: zodResolver(EditSchema),
    defaultValues: {
      vehicleId: "",
      sourceCity: "",
      destinationCity: "",
      departureTimeLocal: "",
      pricePerSeat: 0,
      approvalMode: "AUTO",
    },
  });

  React.useEffect(() => {
    const ride = rideQuery.data;
    if (!ride) return;

    form.reset({
      vehicleId: ride.vehicleId,
      sourceCity: ride.sourceCity,
      destinationCity: ride.destinationCity,
      departureTimeLocal: toDatetimeLocalValue(ride.departureTime),
      pricePerSeat: ride.pricePerSeat,
      approvalMode: ride.approvalMode === 1 ? "MANUAL" : "AUTO",
    });

    setStops(
      ride.stops
        .slice()
        .sort((a, b) => a.stopOrder - b.stopOrder)
        .map((s) => ({
          stopOrder: s.stopOrder,
          cityName: s.cityName,
          latitude: s.latitude,
          longitude: s.longitude,
        }))
    );
  }, [rideQuery.data, form]);

  const watchedVehicleId = useWatch({ control: form.control, name: "vehicleId" });
  const watchedApprovalMode = useWatch({ control: form.control, name: "approvalMode" });

  const updateMutation = useMutation({
    mutationFn: async (values: EditValues) => {
      const ms = new Date(values.departureTimeLocal).getTime();

      if (!stops.length) throw new Error("Ride has no stops");
      if (stops.length < 2) throw new Error("Ride must have at least 2 stops");
      if (stops.some((s) => !s.cityName.trim())) {
        throw new Error("Each stop must have a city name");
      }

      return updateRide(rideId, {
        vehicleId: values.vehicleId,
        sourceCity: values.sourceCity,
        destinationCity: values.destinationCity,
        departureTime: ms,
        pricePerSeat: values.pricePerSeat,
        approvalMode: values.approvalMode,
        stops: stops.map((s) => ({
          stopOrder: s.stopOrder,
          cityName: s.cityName,
          latitude: s.latitude,
          longitude: s.longitude,
        })),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.rides });
      await queryClient.invalidateQueries({ queryKey: queryKeys.ride(rideId) });
      toast.success("Ride updated");
      router.push("/driver/rides");
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const parsed = EditSchema.safeParse(values);
    if (!parsed.success) {
      toast.error("Fix ride inputs first");
      return;
    }

    try {
      await updateMutation.mutateAsync(parsed.data);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to update ride";
      toast.error(message);
    }
  });

  const vehicles = vehiclesQuery.data?.vehicles ?? [];

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Edit ride"
        description="Update departure time, pricing, and stop names."
        right={
          <Button variant="outline" asChild>
            <Link href="/driver/rides">Back</Link>
          </Button>
        }
      />

      {rideQuery.isError ? (
        <Card>
          <CardHeader>
            <CardTitle>Failed to load ride</CardTitle>
            <CardDescription>
              {rideQuery.error instanceof Error
                ? rideQuery.error.message
                : "Unknown error"}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Ride info</CardTitle>
          <CardDescription>These fields are used when updating the ride.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={onSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Vehicle</Label>
                <Select
                  value={watchedVehicleId ?? ""}
                  onValueChange={(v) =>
                    form.setValue("vehicleId", v ?? "", { shouldValidate: true })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map((v) => (
                      <SelectItem key={v.vehicleId} value={v.vehicleId}>
                        {v.make} {v.model} • {v.licensePlate}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.vehicleId ? (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.vehicleId.message}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="pricePerSeat">Price / seat</Label>
                <Input
                  id="pricePerSeat"
                  type="number"
                  min={0}
                  {...form.register("pricePerSeat")}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="sourceCity">Source city</Label>
                <Input id="sourceCity" readOnly {...form.register("sourceCity")} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="destinationCity">Destination city</Label>
                <Input id="destinationCity" readOnly {...form.register("destinationCity")} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="departureTimeLocal">Departure time</Label>
                <Input
                  id="departureTimeLocal"
                  type="datetime-local"
                  {...form.register("departureTimeLocal")}
                />
                {form.formState.errors.departureTimeLocal ? (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.departureTimeLocal.message}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label>Approval mode</Label>
                <Select
                  value={watchedApprovalMode ?? "AUTO"}
                  onValueChange={(v) => {
                    if (v == null) return;
                    form.setValue("approvalMode", v, { shouldValidate: true });
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AUTO">AUTO</SelectItem>
                    <SelectItem value="MANUAL">MANUAL</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  AUTO approves bookings immediately. MANUAL requires you to approve each booking.
                </p>
              </div>
            </div>

            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {stops.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Stops</CardTitle>
            <CardDescription>Rename stops (lat/lng are fixed).</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {stops.map((s) => (
              <div
                key={s.stopOrder}
                className="grid items-center gap-2 rounded-lg border p-3 sm:grid-cols-12"
              >
                <div className="sm:col-span-1">
                  <Badge variant="outline">{s.stopOrder}</Badge>
                </div>
                <div className="grid gap-1 sm:col-span-5">
                  <Label className="text-xs">City name</Label>
                  <Input
                    value={s.cityName}
                    onChange={(e) => {
                      const v = e.target.value;
                      setStops((prev) =>
                        prev.map((p) =>
                          p.stopOrder === s.stopOrder ? { ...p, cityName: v } : p
                        )
                      );
                    }}
                  />
                </div>
                <div className="grid gap-1 sm:col-span-3">
                  <Label className="text-xs">Lat</Label>
                  <Input value={String(s.latitude)} readOnly />
                </div>
                <div className="grid gap-1 sm:col-span-3">
                  <Label className="text-xs">Lng</Label>
                  <Input value={String(s.longitude)} readOnly />
                </div>
              </div>
            ))}
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground">
            Stops are ordered {stops[0]?.stopOrder}..{stops[stops.length - 1]?.stopOrder}.
          </CardFooter>
        </Card>
      ) : null}
    </div>
  );
}
