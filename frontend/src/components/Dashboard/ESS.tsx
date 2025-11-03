import React, { useEffect, useState } from "react";

type PlantConfigDevice = {
  device_id: number;
  parent_id: number;
  name: string;
  class_id: number;
  plant_id?: number | string;
  children?: PlantConfigDevice[];
};

type PlantConfigResponse = {
  devices: PlantConfigDevice[];
};

interface ESSProps {
  tenantId: string;
}

const REFRESH_INTERVAL = 60;

const DEVICE_IDS = [
  10, 11, 12, 13, 14, // SmartLoggers
  101101, 101102, 101103, 101104, 101105, // SmartLogger 1 counters
  101201, 101202, 101203, 101204, 101205, // SmartLogger 1 inverters

  111101, 111102, 111103, 111104, 111105, // SmartLogger 2 counters
  111201, 111202, 111203, 111204, 111205, // SmartLogger 2 inverters

  121101, 121102, 121103, 121104, 121105, // SmartLogger 3 counters
  121201, 121202, 121203, 121204, 121205, // SmartLogger 3 inverters

  131101, 131102, 131103, 131104, 131105, // SmartLogger 4 counters
  131201, 131202, 131203, 131204, 131205, // SmartLogger 4 inverters

  141101, 141102, 141103, 141104, 141105, // SmartLogger 5 counters
  141201, 141202, 141203, 141204, 141205, // SmartLogger 5 inverters
];

export default function ESS({ tenantId }: ESSProps) {
  const [deviceTree, setDeviceTree] = useState<PlantConfigDevice[]>([]);
  const [selected, setSelected] = useState<PlantConfigDevice | null>(null);
  const [plantId, setPlantId] = useState<number | string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const buildTree = (devices: PlantConfigDevice[]): PlantConfigDevice[] => {
    const map: Record<number, PlantConfigDevice> = {};

    // создаём полные копии устройств
    devices.forEach((d) => {
      map[d.device_id] = { ...d, children: [] };
    });

    const tree: PlantConfigDevice[] = [];

    devices.forEach((d) => {
      const node = map[d.device_id];
      if (d.parent_id === 0) {
        tree.push(node);
      } else if (map[d.parent_id]) {
        map[d.parent_id].children!.push(node);
      }
    });

    return tree;
  };

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

    let detectedPlantId: number | string | null =
      data.devices.find((d) => d.plant_id)?.plant_id ?? null;

    if (!detectedPlantId) {
      const parsed = Number(tenantId);
      detectedPlantId = isNaN(parsed) ? tenantId : parsed;
    }

    setPlantId(detectedPlantId);

    const filteredDevices = data.devices
      .filter((d) => DEVICE_IDS.includes(d.device_id))
      .map((d) => ({
        ...d,
        plant_id: d.plant_id ?? detectedPlantId,
      }));

    const tree = buildTree(filteredDevices);
    setDeviceTree(tree);
  };

  const fetchDevices = async () => {
    if (!tenantId) return;
    try {
      setLoading(true);
      const token = localStorage.getItem("access_token");
      if (!token) throw new Error("Нет токена авторизации.");
      await fetchPlantConfig(tenantId, token);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      setDeviceTree([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, REFRESH_INTERVAL * 1000);
    return () => clearInterval(interval);
  }, [tenantId]);

 const handleSelect = (device: PlantConfigDevice) => {
  // создаём копию, чтобы не затирались поля от родителя
  setSelected({ ...device });
};

const renderTree = (devices: PlantConfigDevice[], level = 0) =>
  devices.map((device) => (
    <li
      key={device.device_id}
      className={`p-2 rounded-md cursor-pointer transition-colors duration-150 ${
        selected?.device_id === device.device_id
          ? "bg-blue-100 border border-blue-400"
          : "hover:bg-gray-100"
      }`}
      style={{ marginLeft: `${level * 20}px` }}
      onClick={(e) => {
        e.stopPropagation(); // чтобы клик не всплывал к родителю
        handleSelect(device);
      }}
    >
      <div className="flex items-center">
        <span>
          • {device.name || "Без имени"}{" "}
          <span className="text-xs text-gray-500">
            (ID: {device.device_id}, CLASS: {device.class_id})
          </span>
        </span>
      </div>
      {device.children && device.children.length > 0 && (
        <ul className="mt-1">{renderTree(device.children, level + 1)}</ul>
      )}
    </li>
  ));

  if (loading) return <div className="p-6">Загрузка устройств...</div>;
  if (error) return <div className="p-6 text-red-600">Ошибка: {error}</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Устройства (Всегда раскрытое дерево)</h2>
        <ul className="space-y-1">{renderTree(deviceTree)}</ul>
      </div>

      {selected && (
        <div className="p-4 border rounded-lg bg-gray-50">
          <h3 className="text-lg font-semibold mb-2">Информация об устройстве:</h3>
          <p>
            <strong>PLANT_ID:</strong> {selected.plant_id ?? plantId ?? "—"}
          </p>
          <p>
            <strong>DEVICE_ID:</strong> {selected.device_id}
          </p>
          <p>
            <strong>CLASS_ID:</strong> {selected.class_id}
          </p>
        </div>
      )}
    </div>
  );
}