import React, { useEffect, useState } from "react";
import { obtenerProyectosEliminados, restablecerProyectoTrl } from "../../../lib/trlApi";

type DeletedProject = {
  "Nombre del Proyecto": string;
  "Anio Registro"?: number | null;
  "Eliminado En"?: string;
};

interface RestoreDeletedProjectsProps {
  year: number;
  onRefresh?: () => Promise<void> | void;
}

function formatDeletedAt(value: string | undefined) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-PE");
}

const RestoreDeletedProjects: React.FC<RestoreDeletedProjectsProps> = ({ year, onRefresh }) => {
  const [items, setItems] = useState<DeletedProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringName, setRestoringName] = useState("");
  const [error, setError] = useState("");

  const loadDeletedProjects = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await obtenerProyectosEliminados(year);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error al cargar proyectos eliminados:", err);
      setError("No se pudo cargar la lista de proyectos eliminados.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeletedProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  const handleRestore = async (project: DeletedProject) => {
    const nombre = String(project["Nombre del Proyecto"] || "").trim();
    if (!nombre) return;
    if (!confirm(`Restablecer el proyecto "${nombre}"?`)) return;
    setRestoringName(nombre);
    try {
      await restablecerProyectoTrl(nombre, year);
      await loadDeletedProjects();
      if (onRefresh) await onRefresh();
    } catch (err) {
      console.error("Error al restablecer proyecto:", err);
      alert("No se pudo restablecer el proyecto.");
    } finally {
      setRestoringName("");
    }
  };

  return (
    <section>
      <p className="text-sm text-gray-600 mb-4">Muestra los proyectos eliminados manualmente para el año {year}.</p>

      {loading && <div className="text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-4">Cargando proyectos eliminados...</div>}

      {!loading && error && <div className="text-red-700 bg-red-50 border border-red-200 rounded-lg p-4">{error}</div>}

      {!loading && !error && items.length === 0 && (
        <div className="text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-4">No hay proyectos eliminados para este año.</div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="overflow-x-auto bg-white shadow-lg rounded-xl border border-gray-200">
          <table className="min-w-full text-base text-left text-gray-800">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 font-semibold">Proyecto</th>
                <th className="px-6 py-4 font-semibold">Anio</th>
                <th className="px-6 py-4 font-semibold">Eliminado en</th>
                <th className="px-6 py-4 font-semibold">Acción</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const nombre = String(item["Nombre del Proyecto"] || "").trim();
                const itemYear = Number(item["Anio Registro"] || 0) || year;
                const disabled = restoringName === nombre;
                return (
                  <tr key={`${nombre}-${itemYear}-${idx}`} className="border-t">
                    <td className="px-6 py-4 font-medium">{nombre || "Sin nombre"}</td>
                    <td className="px-6 py-4">{itemYear}</td>
                    <td className="px-6 py-4">{formatDeletedAt(String(item["Eliminado En"] || ""))}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleRestore(item)}
                        disabled={disabled}
                        className="px-3 py-1 text-sm bg-emerald-100 text-emerald-700 rounded-md hover:bg-emerald-200 disabled:opacity-60 transition"
                      >
                        {disabled ? "Restableciendo..." : "Restablecer"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default RestoreDeletedProjects;
