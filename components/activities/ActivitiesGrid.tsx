"use client"

import { useState } from "react"

export default function ActivitiesGrid() {
  const [search, setSearch] = useState("")

  const activities = [
    { id: 1, title: "Mankšta", time: "09:00", place: "Salė" },
    { id: 2, title: "Muzika", time: "11:00", place: "Poilsio zona" },
  ]

  const filtered = activities.filter(a =>
    a.title.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <input
        placeholder="Ieškoti veiklos..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          padding: 10,
          borderRadius: 10,
          border: "1px solid #ccc"
        }}
      />

      <div style={{ display: "grid", gap: 12 }}>
        {filtered.map(a => (
          <div key={a.id} style={{
            padding: 16,
            borderRadius: 16,
            border: "1px solid #e2e8f0",
            background: "#fff"
          }}>
            <b>{a.title}</b><br/>
            {a.time} · {a.place}
          </div>
        ))}
      </div>
    </div>
  )
}