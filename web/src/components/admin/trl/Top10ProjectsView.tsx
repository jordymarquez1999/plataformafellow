import React, { useState } from "react";
import ProjectsTable from "./ProjectsTable";
import { descargarReporteTop10 } from "../../../lib/trlApi";

interface Top10ProjectsViewProps {
  proyectos: any[];
  year: number;
  onRefresh?: () => Promise<void> | void;
}

const Top10ProjectsView: React.FC<Top10ProjectsViewProps> = ({ proyectos, year, onRefresh }) => {
  const top10 = [...proyectos].sort((a, b) => b["Puntaje Total"] - a["Puntaje Total"]).slice(0, 10);
  const [currentPage, setCurrentPage] = useState(1);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-xl font-bold py-6 text-gray-800">Top 10 proyectos con mayor puntaje</h3>
        <button
          onClick={() => descargarReporteTop10(year)}
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition"
        >
          Descargar reporte
        </button>
      </div>
      <ProjectsTable proyectos={top10} currentPage={currentPage} itemsPerPage={10} setCurrentPage={setCurrentPage} hidePagination year={year} onRefresh={onRefresh} />
    </div>
  );
};

export default Top10ProjectsView;
