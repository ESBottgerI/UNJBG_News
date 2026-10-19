"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Result = {
  id: string;
  title: string;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  createdAt: string;
};

export default function BuscarPage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (q.length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(data.results || []);
      } catch (e) {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Buscar noticias</h1>
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar..."
        className="w-full p-2 border rounded mb-4"
      />
      {loading && <p>Buscando...</p>}
      <div className="space-y-4">
        {results.map((r) => (
          <Link key={r.id} href={`/noticias/${r.id}`} className="flex gap-4 p-4 border rounded hover:bg-gray-50">
            {(r.thumbnailUrl || r.imageUrl) && (
              <img src={r.thumbnailUrl || r.imageUrl || ""} alt="" className="w-24 h-24 object-cover rounded" />
            )}
            <div>
              <h2 className="font-semibold">{r.title}</h2>
              <p className="text-sm text-gray-500">{r.publishedAt ? new Date(r.publishedAt).toLocaleDateString("es-PE") : ""}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
