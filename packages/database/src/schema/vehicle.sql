/* @name IVehicle */
SELECT
  id,
  owner_id,
  make,
  model,
  year,
  color,
  license_plate,
  seat_capacity,
  created_at
FROM vehicles
LIMIT 1;

/* @name IVehicleDocument */
SELECT
  id,
  vehicle_id,
  document_type,
  document_url,
  verification_status,
  uploaded_at 
FROM vehicle_documents
LIMIT 1;

