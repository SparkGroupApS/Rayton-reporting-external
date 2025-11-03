import React, { useEffect, useState } from "react";

type RealtimeDataPoint = {
  data_id: number;
  plant_id: number;
  device_id: number;
  name: string;
  timestamp: number;
  value: number | null;
};

type RealtimeDataResponse = {
  values: RealtimeDataPoint[];
};

type PlantConfigDevice = {
  device_id: number;
  name: string;
};

type PlantConfigResponse = {
  devices: PlantConfigDevice[];
};

interface SmartloggerProps {
  tenantId: string;
}

const REFRESH_INTERVAL = 60;
const DEVICE_IDS = [10, 101001, 101002];

export default function Smartlogger({ tenantId }: SmartloggerProps) {
  const [logs, setLogs] = useState<RealtimeDataPoint[]>([]);
  const [deviceNames, setDeviceNames] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlantConfig = async (tenantId: string, token: string) => {
    const res = await fetch(
      `http://localhost:8000/api/v1/plant-config?tenant_id=${tenantId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );
    if (!res.ok) throw new Error("Ошибка при получении PLANT_CONFIG");
    const data: PlantConfigResponse = await res.json();
    const namesMap = data.devices.reduce((acc, d) => {
      acc[d.device_id] = d.name;
      return acc;
    }, {} as Record<number, string>);
    setDeviceNames(namesMap);
  };

  const fetchLogs = async () => {
    if (!tenantId) return;

    try {
      setLoading(true);

      const token = localStorage.getItem("access_token");
      if (!token) throw new Error("Нет токена авторизации.");

      // Получаем plant config (названия устройств)
      await fetchPlantConfig(tenantId, token);

      // Получаем realtime данные
      const query = new URLSearchParams();
      query.append("tenant_id", tenantId);
      DEVICE_IDS.forEach((id) => query.append("device_ids", id.toString()));

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

  const groupedByDevice = logs.reduce((acc, log) => {
    if (!acc[log.device_id]) acc[log.device_id] = [];
    acc[log.device_id].push(log);
    return acc;
  }, {} as Record<number, RealtimeDataPoint[]>);

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Smart Logger (Realtime)</h2>
        <span className="text-sm text-gray-500">
          Автообновление каждые {REFRESH_INTERVAL} с
        </span>
      </div>

      {Object.entries(groupedByDevice).map(([deviceId, deviceLogs]) => {
        const nameFromConfig = deviceNames[Number(deviceId)] || "Без имени";

        return (
          <div key={deviceId}>
            <h3 className="text-lg font-semibold mb-2 text-gray-700">
              📟 Device ID: {deviceId} — {nameFromConfig}
            </h3>

            <div className="overflow-x-auto rounded-2xl shadow-md border border-gray-400 bg-white">
              <table
                className="min-w-full border border-gray-400 table-auto"
                style={{ borderCollapse: "collapse" }}
              >
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-400 px-4 py-2 text-left text-sm font-semibold text-gray-700">
                      Время
                    </th>
                    <th className="border border-gray-400 px-4 py-2 text-left text-sm font-semibold text-gray-700">
                      | - Plant_ID - |
                    </th>
                    <th className="border border-gray-400 px-4 py-2 text-left text-sm font-semibold text-gray-700">
                      | - Device_ID - |
                    </th>
                    <th className="border border-gray-400 px-4 py-2 text-left text-sm font-semibold text-gray-700">
                      | - Data_ID - |
                    </th>
                    <th className="border border-gray-400 px-4 py-2 text-left text-sm font-semibold text-gray-700">
                      Устройство / Название
                    </th>
                    <th className="border border-gray-400 px-4 py-2 text-left text-sm font-semibold text-gray-700">
                      Значение
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {deviceLogs.map((log, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="border border-gray-400 px-4 py-2 text-sm text-gray-700">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="border border-gray-400 px-4 py-2 text-sm text-gray-700">
                        {log.plant_id}
                      </td>
                      <td className="border border-gray-400 px-4 py-2 text-sm text-gray-700">
                        {log.device_id}
                      </td>
                      <td className="border border-gray-400 px-4 py-2 text-sm text-gray-700">
                        {log.data_id}
                      </td>
                      <td className="border border-gray-400 px-4 py-2 text-sm text-gray-700">
                        {log.name}
                      </td>
                      <td className="border border-gray-400 px-4 py-2 text-sm text-gray-700">
                        {log.value ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
