"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
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
  createVehicle,
  deleteVehicle,
  listVehicles,
  updateVehicle,
} from "@/features/vehicles/api/vehiclesApi";
import { queryKeys } from "@/lib/query/keys";

const DEFAULT_VEHICLE_YEAR = new Date().getFullYear();

const VehicleSchema = z.object({
  make: z.string().min(1),
  model: z.string().min(1),
  year: z.coerce.number().int().min(1900).max(2100),
  color: z.string().min(1),
  licensePlate: z.string().min(1),
  seatCapacity: z.coerce.number().int().min(1).max(10),
});

type VehicleFormInput = z.input<typeof VehicleSchema>;
type VehicleValues = z.output<typeof VehicleSchema>;

export function VehiclesScreen() {
  const queryClient = useQueryClient();
  const [editingVehicleId, setEditingVehicleId] = React.useState<string | null>(null);

  const vehiclesQuery = useQuery({
    queryKey: queryKeys.vehicles,
    queryFn: listVehicles,
  });

  const createMutation = useMutation({
    mutationFn: createVehicle,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.vehicles });
      toast.success("Vehicle added");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteVehicle,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.vehicles });
      toast.success("Vehicle deleted");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (args: { vehicleId: string; values: VehicleValues }) => {
      return updateVehicle(args.vehicleId, args.values);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.vehicles });
      toast.success("Vehicle updated");
    },
  });

  const form = useForm<VehicleFormInput>({
    resolver: zodResolver(VehicleSchema),
    defaultValues: {
      make: "",
      model: "",
      year: DEFAULT_VEHICLE_YEAR,
      color: "",
      licensePlate: "",
      seatCapacity: 4,
    },
  });

  const resetForm = React.useCallback(() => {
    setEditingVehicleId(null);
    form.reset({
      make: "",
      model: "",
      year: DEFAULT_VEHICLE_YEAR,
      color: "",
      licensePlate: "",
      seatCapacity: 4,
    });
  }, [form]);

  const onSubmit = form.handleSubmit(async (values) => {
    const parsed = VehicleSchema.safeParse(values);
    if (!parsed.success) return;

    try {
      const v: VehicleValues = parsed.data;
      if (editingVehicleId) {
        await updateMutation.mutateAsync({ vehicleId: editingVehicleId, values: v });
      } else {
        await createMutation.mutateAsync(v);
      }
      resetForm();
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : editingVehicleId
            ? "Failed to update vehicle"
            : "Failed to add vehicle";
      toast.error(message);
    }
  });

  const vehicles = vehiclesQuery.data?.vehicles ?? [];

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Vehicles"
        description="Add at least one vehicle to publish rides."
      />

      <Card>
        <CardHeader>
          <CardTitle>{editingVehicleId ? "Edit vehicle" : "Add vehicle"}</CardTitle>
          <CardDescription>Vehicle details shown to passengers.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={onSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="make">Make</Label>
                <Input id="make" {...form.register("make")} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="model">Model</Label>
                <Input id="model" {...form.register("model")} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="year">Year</Label>
                <Input id="year" type="number" {...form.register("year")} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="color">Color</Label>
                <Input id="color" {...form.register("color")} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="licensePlate">License plate</Label>
                <Input id="licensePlate" {...form.register("licensePlate")} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="seatCapacity">Seat capacity</Label>
                <Input
                  id="seatCapacity"
                  type="number"
                  min={1}
                  max={10}
                  {...form.register("seatCapacity")}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingVehicleId
                  ? updateMutation.isPending
                    ? "Saving…"
                    : "Save changes"
                  : createMutation.isPending
                    ? "Saving…"
                    : "Add vehicle"}
              </Button>
              {editingVehicleId ? (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel edit
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Your vehicles</h2>
          {vehicles.length ? (
            <Badge variant="secondary">{vehicles.length}</Badge>
          ) : null}
        </div>

        {vehiclesQuery.isError ? (
          <Card>
            <CardHeader>
              <CardTitle>Failed to load vehicles</CardTitle>
              <CardDescription>
                {vehiclesQuery.error instanceof Error
                  ? vehiclesQuery.error.message
                  : "Unknown error"}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {vehicles.length === 0 && !vehiclesQuery.isPending && !vehiclesQuery.isError ? (
          <Card>
            <CardHeader>
              <CardTitle>No vehicles</CardTitle>
              <CardDescription>Add one above to publish rides.</CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {vehicles.map((v) => (
          <Card key={v.vehicleId}>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="grid gap-1">
                  <CardTitle className="text-base">
                    {v.make} {v.model} ({v.year})
                  </CardTitle>
                  <CardDescription>
                    {v.color} • {v.licensePlate}
                  </CardDescription>
                </div>
                <Badge variant="outline">{v.seatCapacity} seats</Badge>
              </div>
            </CardHeader>
            <CardFooter className="justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setEditingVehicleId(v.vehicleId);
                  form.reset({
                    make: v.make,
                    model: v.model,
                    year: v.year,
                    color: v.color,
                    licensePlate: v.licensePlate,
                    seatCapacity: v.seatCapacity,
                  });
                }}
                disabled={updateMutation.isPending || createMutation.isPending}
              >
                Edit
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteMutation.mutate(v.vehicleId)}
                disabled={deleteMutation.isPending || updateMutation.isPending}
              >
                Delete
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
