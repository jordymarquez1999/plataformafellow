import React, { useEffect, useState } from "react";
import { buscarProyecto, descargarReporteAprobados, descargarReporteTop10 } from "../../../lib/trlApi";
import ProjectDetailModal from "./ProjectDetailModal";
import { FiSearch, FiDownload } from "react-icons/fi";

interface ProjectData {
  [key: string]: any;
}

interface ProjectSearchProps {
  year: number;
}

const ProjectSearch: React.FC<ProjectSearchProps> = ({ year }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<ProjectData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    setSearchResults([]);
    setSelectedProject(null);
    setIsModalOpen(false);
  }, [year]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchTerm.trim()) return;

    setIsSearching(true);
    try {
      const results = await buscarProyecto(searchTerm, year);
      setSearchResults(results || []);
    } catch (error) {
      console.error("Error searching:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleViewDetails = (project: ProjectData) => {
    setSelectedProject(project);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <section className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
        <h4 className="text-xl font-semibold text-gray-800 mb-4">Acciones rápidas</h4>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => descargarReporteAprobados(year)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-lg transition"
          >
            <FiDownload />
            Descargar aprobados (CSV)
          </button>
          <button
            onClick={() => descargarReporteTop10(year)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-lg transition"
          >
            <FiDownload />
            Descargar reporte Top 10
          </button>
        </div>
      </section>

      <section>
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row flex-wrap gap-4 mb-6 w-full">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar proyecto por nombre..."
            className="flex-grow w-full sm:w-auto px-4 py-2 text-lg border border-gray-300 rounded-md focus:ring-2 focus:outline-none focus:ring-purple-500 focus:border-purple-500"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="w-full sm:w-auto px-4 py-2 text-base bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2 transition"
          >
            <FiSearch />
            {isSearching ? "Buscando..." : "Buscar"}
          </button>
        </form>
      </section>

      {searchResults.length > 0 && (
        <div className="overflow-x-auto bg-white rounded-lg shadow border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-lg text-left font-semibold text-gray-600">Proyecto</th>
                <th className="px-6 py-3 text-lg text-left font-semibold text-gray-600">Aprobado</th>
                <th className="px-6 py-3 text-lg text-left font-semibold text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {searchResults.map((proyecto, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-pre-wrap text-lg text-gray-800 font-medium">{proyecto["Nombre del Proyecto"]}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 inline-flex text-lg font-medium rounded-full ${proyecto.Aprobado === "Si" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {proyecto.Aprobado}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button onClick={() => handleViewDetails(proyecto)} className="px-3 py-1 bg-blue-100 text-blue-700 text-lg rounded hover:bg-blue-200">
                      Ver detalle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && selectedProject && <ProjectDetailModal project={selectedProject} onClose={() => setIsModalOpen(false)} year={year} />}
    </div>
  );
};

export default ProjectSearch;
