CREATE TABLE vehicles (
    id UUID PRIMARY KEY,
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    make TEXT,
    model TEXT,
    year INT,
    color TEXT,
    license_plate TEXT UNIQUE,
    seat_capacity INT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE vehicle_documents (
    id UUID PRIMARY KEY,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
    document_type TEXT,
    document_url TEXT,
    verification_status TEXT,
    uploaded_at TIMESTAMP DEFAULT NOW()
);