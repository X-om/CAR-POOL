import Link from "next/link";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-10 px-4 py-10">
      <div className="grid gap-6 lg:grid-cols-2 lg:items-center">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">v1</Badge>
            <span className="text-sm text-muted-foreground">Car pooling demo</span>
          </div>

          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Car Pool
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground sm:text-base">
            Search rides along a route, book a leg, and track trips in realtime.
          </p>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild>
              <Link href="/auth/sign-in">Sign in</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/passenger/search">Search rides</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Search</CardTitle>
              <CardDescription>Find rides by cities.</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <Image src="/globe.svg" alt="Search" width={64} height={64} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Publish</CardTitle>
              <CardDescription>Create routes and stops.</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <Image src="/next.svg" alt="Publish" width={64} height={64} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Trips</CardTitle>
              <CardDescription>Start and complete trips.</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <Image src="/window.svg" alt="Trips" width={64} height={64} />
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Passenger</CardTitle>
            <CardDescription>
              Find rides and book seats with leg pricing.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Search by origin and destination and we’ll match rides that pass
            along the way.
          </CardContent>
          <CardFooter className="gap-2">
            <Button asChild>
              <Link href="/passenger/search">Search rides</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/passenger/bookings">My bookings</Link>
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Driver</CardTitle>
            <CardDescription>
              Publish rides with route alternatives and auto-generated stops.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Create a route using Mapbox Directions, review the stop list, then
            publish.
          </CardContent>
          <CardFooter className="gap-2">
            <Button asChild>
              <Link href="/driver/rides/new">Publish ride</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/driver/vehicles">Vehicles</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
