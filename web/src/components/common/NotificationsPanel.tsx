import { useEffect, useState } from "react";
import { apiGet, apiPost } from "../../lib/api";

type Notification = {
  id: string;
  type: string;
  message: string;
  created_at: string;
  read_at?: string;
};

type Props = {
  userId: string;
};

export default function NotificationsPanel({ userId }: Props) {
  const [items, setItems] = useState<Notification[]>([]);

  async function load() {
    const data = await apiGet(`/notifications?userId=${userId}`);
    setItems(data);
  }

  useEffect(() => {
    if (userId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function markRead(id: string) {
    await apiPost(`/notifications/${id}/read`, {});
    await load();
  }

  return (
    <div className="space-y-2">
      {items.map((n) => (
        <div key={n.id} className="border rounded-lg p-2 bg-white text-sm">
          <div className="font-medium">{n.type}</div>
          <div>{n.message}</div>
          <div className="text-xs text-slate-500">{new Date(n.created_at).toLocaleString()}</div>
          {!n.read_at && (
            <button className="text-xs text-indigo-600" onClick={() => markRead(n.id)}>
              Marcar como leida
            </button>
          )}
        </div>
      ))}
      {items.length === 0 && <div className="text-sm text-slate-500">Sin notificaciones.</div>}
    </div>
  );
}
