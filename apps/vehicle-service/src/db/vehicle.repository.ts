import { db } from '@repo/database';
import { v4 as uuidv4 } from 'uuid';

type DbVehicleRow = {
  id: string;
  owner_id: string;
  make: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  license_plate: string | null;
  seat_capacity: number | null;
};

export const vehicleRepository = {
  async createVehicle(input: {
    ownerId: string;
    make: string;
    model: string;
    year: number;
    color: string;
    licensePlate: string;
    seatCapacity: number;
  }): Promise<string> {
    const id = uuidv4();
    await db.query(
      `
      INSERT INTO vehicles (id, owner_id, make, model, year, color, license_plate, seat_capacity)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [id, input.ownerId, input.make, input.model, input.year, input.color, input.licensePlate, input.seatCapacity],
    );
    return id;
  },

  async updateVehicle(input: {
    vehicleId: string;
    ownerId: string;
    make: string;
    model: string;
    year: number;
    color: string;
    licensePlate: string;
    seatCapacity: number;
  }): Promise<boolean> {
    const res = await db.query(
      `
      UPDATE vehicles
      SET make = $3, model = $4, year = $5, color = $6, license_plate = $7, seat_capacity = $8
      WHERE id = $1 AND owner_id = $2
      `,
      [
        input.vehicleId,
        input.ownerId,
        input.make,
        input.model,
        input.year,
        input.color,
        input.licensePlate,
        input.seatCapacity,
      ],
    );
    return res.rowCount === 1;
  },

  async deleteVehicle(input: { vehicleId: string; ownerId: string }): Promise<boolean> {
    const res = await db.query(`DELETE FROM vehicles WHERE id = $1 AND owner_id = $2`, [input.vehicleId, input.ownerId]);
    return res.rowCount === 1;
  },

  async getVehicle(vehicleId: string): Promise<DbVehicleRow> {
    const res = await db.query<DbVehicleRow>(
      `
      SELECT id, owner_id, make, model, year, color, license_plate, seat_capacity
      FROM vehicles
      WHERE id = $1
      LIMIT 1
      `,
      [vehicleId],
    );
    const row = res.rows[0];
    if (!row) throw new Error('VEHICLE_NOT_FOUND');
    return row;
  },

  async getVehicleOptional(vehicleId: string): Promise<DbVehicleRow | null> {
    const res = await db.query<DbVehicleRow>(
      `
      SELECT id, owner_id, make, model, year, color, license_plate, seat_capacity
      FROM vehicles
      WHERE id = $1
      LIMIT 1
      `,
      [vehicleId],
    );
    return res.rows[0] ?? null;
  },

  async listVehiclesByOwner(ownerId: string): Promise<DbVehicleRow[]> {
    const res = await db.query<DbVehicleRow>(
      `
      SELECT id, owner_id, make, model, year, color, license_plate, seat_capacity
      FROM vehicles
      WHERE owner_id = $1
      ORDER BY created_at DESC
      `,
      [ownerId],
    );
    return res.rows;
  },
};
