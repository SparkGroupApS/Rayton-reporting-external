import React, { useEffect, useState } from "react";

type RealtimeDataPoint = {
  data_id: number;
  plant_id: number;
  device_id: number;
  name: string;
  timestamp: number; // миллисекунды
  value: number | null;
};

type RealtimeDataResponse = {
  values: RealtimeDataPoint[];
};

interface SmartloggerProps {
  tenantId: string; // tenant передаётся как проп
}

// Интервал автообновления (секунды)
const REFRESH_INTERVAL = 60;

// DEVICE_IDs фиксированные (можно тоже получать динамически)
const DEVICE_ID = [10, 101001, 101002];

export default function Smartlogger({ tenantId }: SmartloggerProps) {
  const [logs, setLogs] = useState<RealtimeDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    if (!tenantId) return;

    try {
      setLoading(true);

      const query = new URLSearchParams();
      query.append("tenant_id", tenantId);
      DEVICE_ID.forEach((id) => query.append("device_ids", id.toString()));

      const token = localStorage.getItem("access_token");
      if (!token) throw new Error("Нет токена авторизации.");

      const res = await fetch(
        `http://localhost:8000/api/v1/realtime-data/latest?${query}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) {
        if (res.status === 401) throw new Error("Не авторизован. Проверьте токен.");
        if (res.status === 403) throw new Error("Нет доступа к этому тенанту.");
        throw new Error(`Ошибка запроса: ${res.status}`);
      }

      const data: RealtimeDataResponse = await res.json();
      setLogs(data.values);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, REFRESH_INTERVAL * 1000);
    return () => clearInterval(interval);
  }, [tenantId]);

  if (loading) return <div className="p-6">Загрузка данных...</div>;
  if (error) return <div className="p-6 text-red-600">Ошибка: {error}</div>;




  
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Smart Logger (Realtime)</h2>
        <span className="text-sm text-gray-500">
          Автообновление каждые {REFRESH_INTERVAL} с
        </span>
      </div>


<div className="overflow-x-auto rounded-2xl shadow-md border border-gray-300">
  <table className="min-w-full border-collapse">
    <thead>
      <tr className="bg-gray-100">
        <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold text-gray-700">Время</th>
        <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold text-gray-700">Plant</th>
        <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold text-gray-700">Устройство / Название</th>
        <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold text-gray-700">Значение</th>
      </tr>
    </thead>
    <tbody>
      {logs.map((log, index) => (
        <tr key={index} className="hover:bg-gray-50">
          <td className="border border-gray-300 px-4 py-2 text-sm text-gray-700">{new Date(log.timestamp).toLocaleString()}</td>
          <td className="border border-gray-300 px-4 py-2 text-sm text-gray-700">{log.plant_id}</td>
          <td className="border border-gray-300 px-4 py-2 text-sm text-gray-700">{log.name}</td>
          <td className="border border-gray-300 px-4 py-2 text-sm text-gray-700">{log.value ?? "-"}</td>
        </tr>
      ))}
    </tbody>
  </table>
</div>








    </div>
  );
}
