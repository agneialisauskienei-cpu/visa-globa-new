"use client";

import { useMemo, useState } from "react";

type RoomTypeKey = "single" | "double" | "triple" | "quad";

type Room = {
  number: number;
  type: RoomTypeKey;
  typeLabel: string;
};

const ROOM_TYPES: { key: RoomTypeKey; label: string }[] = [
  { key: "single", label: "Vienvietis" },
  { key: "double", label: "Dvivietis" },
  { key: "triple", label: "Trivietis" },
  { key: "quad", label: "Keturvietis" },
];

const FEATURES = [
  { key: "kitchenette", label: "Virtuvėlė" },
  { key: "accessible", label: "Pritaikyta neįgaliesiems" },
  { key: "bathroom", label: "Sanitarinis mazgas" },
  { key: "call", label: "Iškvietimo mygtukas" },
] as const;

type FeatureKey = (typeof FEATURES)[number]["key"];

export default function GlobaKambariuSuvedimas() {
  const [total, setTotal] = useState(80);
  const [startNumber, setStartNumber] = useState(1);

  const [rooms, setRooms] = useState<Record<RoomTypeKey, number>>({
    single: 30,
    double: 20,
    triple: 10,
    quad: 20,
  });

  const [features, setFeatures] = useState<Record<FeatureKey, boolean>>({
    kitchenette: false,
    accessible: false,
    bathroom: false,
    call: false,
  });

  const [generatedRooms, setGeneratedRooms] = useState<Room[]>([]);

  const sum = useMemo(() => {
    return Object.values(rooms).reduce((a, b) => a + Number(b || 0), 0);
  }, [rooms]);

  const diff = total - sum;
  const isValid = total > 0 && diff === 0;

  const updateRoom = (key: RoomTypeKey, value: string) => {
    const parsed = Math.max(0, Number(value) || 0);

    setRooms((prev) => ({
      ...prev,
      [key]: parsed,
    }));
  };

  const toggleFeature = (key: FeatureKey) => {
    setFeatures((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const generateRooms = () => {
    if (!isValid) {
      alert("Pirmiausia suvesk teisingą kambarių sumą.");
      return;
    }

    const result: Room[] = [];
    let currentNumber = startNumber;

    for (const roomType of ROOM_TYPES) {
      const count = Number(rooms[roomType.key] || 0);

      for (let i = 0; i < count; i++) {
        result.push({
          number: currentNumber,
          type: roomType.key,
          typeLabel: roomType.label,
        });

        currentNumber++;
      }
    }

    setGeneratedRooms(result);
  };

  const saveAll = () => {
    const payload = {
      total,
      startNumber,
      roomsByType: rooms,
      features,
      generatedRooms,
    };

    console.log("Išsaugomi duomenys:", payload);
    alert("Duomenys paruošti. Žiūrėk console.log");
  };

  return (
    <div style={{ padding: 20, fontFamily: "Arial, sans-serif", maxWidth: 1100 }}>
      <h2>Globos kambarių suvedimas</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div>
          <label style={{ display: "block", marginBottom: 6 }}>Viso kambarių</label>
          <input
            type="number"
            value={total}
            onChange={(e) => setTotal(Number(e.target.value) || 0)}
            style={{ width: "100%", padding: 8 }}
          />
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 6 }}>
            Kambarių numeracijos pradžia
          </label>
          <input
            type="number"
            value={startNumber}
            onChange={(e) => setStartNumber(Number(e.target.value) || 1)}
            style={{ width: "100%", padding: 8 }}
          />
        </div>
      </div>

      <h3>Kambarių tipai</h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(220px, 1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        {ROOM_TYPES.map((roomType) => (
          <div
            key={roomType.key}
            style={{
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: 12,
              background: "#fafafa",
            }}
          >
            <label style={{ display: "block", marginBottom: 6 }}>{roomType.label}</label>
            <input
              type="number"
              value={rooms[roomType.key]}
              onChange={(e) => updateRoom(roomType.key, e.target.value)}
              style={{ width: "100%", padding: 8 }}
            />
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 8 }}>
        <strong>Suma pagal tipus:</strong> {sum}
      </div>

      <div style={{ marginBottom: 8 }}>
        <strong>Skirtumas:</strong> {diff}
      </div>

      {diff !== 0 ? (
        <div
          style={{
            color: "#a61b1b",
            background: "#fff1f1",
            border: "1px solid #f0caca",
            padding: 10,
            borderRadius: 8,
            marginBottom: 20,
          }}
        >
          Kambarių suma nesutampa. Turi būti {total}, dabar yra {sum}.
        </div>
      ) : (
        <div
          style={{
            color: "#176b2c",
            background: "#f1fff5",
            border: "1px solid #c7ebd1",
            padding: 10,
            borderRadius: 8,
            marginBottom: 20,
          }}
        >
          Kambarių suma teisinga. Galima generuoti kambarius.
        </div>
      )}

      <h3>Papildomos savybės</h3>

      <div style={{ marginBottom: 20 }}>
        {FEATURES.map((feature) => (
          <div key={feature.key} style={{ marginBottom: 8 }}>
            <label>
              <input
                type="checkbox"
                checked={features[feature.key]}
                onChange={() => toggleFeature(feature.key)}
                style={{ marginRight: 8 }}
              />
              {feature.label}
            </label>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
        <button
          type="button"
          onClick={generateRooms}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #ccc",
            cursor: "pointer",
          }}
        >
          Sugeneruoti kambarius
        </button>

        <button
          type="button"
          onClick={saveAll}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #ccc",
            cursor: "pointer",
          }}
        >
          Išsaugoti
        </button>
      </div>

      <h3>Masiniu būdu sugeneruoti kambariai</h3>

      {generatedRooms.length === 0 ? (
        <div style={{ color: "#666" }}>Kambariai dar nesugeneruoti.</div>
      ) : (
        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "#f5f5f5" }}>
              <tr>
                <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #ddd" }}>
                  Kambario nr.
                </th>
                <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #ddd" }}>
                  Tipas
                </th>
              </tr>
            </thead>
            <tbody>
              {generatedRooms.map((room) => (
                <tr key={room.number}>
                  <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{room.number}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #eee" }}>{room.typeLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}