import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FiBarChart2, FiList, FiLock, FiRefreshCw, FiChevronUp, FiChevronDown, FiCheckCircle, FiUser, FiZap, FiRotateCcw } from "react-icons/fi";
import { FaRocket } from "react-icons/fa";
import MetricCard from "./MetricCard";
import ProjectSearch from "./ProjectSearch";
import ChartSection from "./ChartSection";
import DataStatus from "./DataStatus";
import GeneralInsights from "./GeneralInsights";
import Top10ProjectsView from "./Top10ProjectsView";
import ProjectsTable from "./ProjectsTable";
import RestoreDeletedProjects from "./RestoreDeletedProjects";
import { actualizarDatos, obtenerProyectos, getMetricasPrincipales, getGraficosData, getInsightsGenerales } from "../../../lib/trlApi";

type TrlTab = "metrics" | "charts" | "search" | "projects-table" | "restore-deleted" | "insights";

const TrlDashboard: React.FC = () => {
  const [isControlExpanded, setIsControlExpanded] = useState(true);
  const [status, setStatus] = useState<{ type: "idle" | "loading" | "success" | "error"; message: string }>({
    type: "idle",
    message: "",
  });

  const [metricas, setMetricas] = useState<any>(null);
  const [graficos, setGraficos] = useState<any>(null);
  const [insights, setInsights] = useState<any>(null);
  const [proyectos, setProyectos] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<TrlTab>("metrics");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const years = [2025, 2026];
  const [selectedYear, setSelectedYear] = useState<number>(2026);

  useEffect(() => {
    handleActualizarDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear]);

  const fetchTrlData = async (forceUpdate: boolean) => {
    setStatus({ type: "loading", message: forceUpdate ? "Actualizando datos..." : "Actualizando vista..." });
    try {
      if (forceUpdate) {
        try {
          await actualizarDatos();
        } catch {
          // continuar con datos en cache si falla la actualización remota
        }
      }
      const [proyectosRes, metricasRes, graficosRes, insightsRes] = await Promise.all([
        obtenerProyectos(selectedYear),
        getMetricasPrincipales(selectedYear),
        getGraficosData(selectedYear),
        getInsightsGenerales(selectedYear),
      ]);
      setProyectos(Array.isArray(proyectosRes) ? proyectosRes : []);
      setMetricas(metricasRes);
      setInsights(insightsRes);
      setGraficos(graficosRes.graficos);
      setStatus({ type: "success", message: forceUpdate ? "Datos actualizados correctamente" : "Vista actualizada" });
    } catch (error: any) {
      console.error("Error al actualizar:", error);
      setStatus({ type: "error", message: "Error al actualizar datos." });
    }
  };

  const handleActualizarDatos = async () => {
    await fetchTrlData(true);
  };

  const handleRefrescarVista = async () => {
    await fetchTrlData(false);
  };

  const tabs: { id: TrlTab; label: string }[] = [
    { id: "metrics", label: "Métricas" },
    { id: "charts", label: "Gráficos" },
    { id: "search", label: "Buscar" },
    { id: "projects-table", label: "Proyectos" },
    { id: "restore-deleted", label: "Restablecer" },
    { id: "insights", label: "Insights" },
  ];

  return (
    <div className="min-h-screen">
      <motion.main className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 pb-12" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-6">
          <motion.h1 className="text-3xl font-bold text-purple-600" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            Dashboard TRL
          </motion.h1>
          <div className="flex gap-2 overflow-x-auto whitespace-nowrap pb-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1 rounded-xl text-sm border transition ${activeTab === tab.id ? "bg-purple-600 text-white border-purple-600" : "bg-white text-gray-700 border-gray-200 hover:border-purple-300"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <motion.section
          className="bg-white rounded-xl shadow-sm overflow-hidden mb-6 border border-gray-200"
          initial={false}
          animate={{ height: isControlExpanded ? "auto" : "64px", overflow: "hidden" }}
          transition={{ type: "spring", damping: 20 }}
        >
          <div className="p-6 border-b border-gray-100 bg-white">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
                <FiLock className="text-purple-600" />
                Control de datos
              </h2>
              <button onClick={() => setIsControlExpanded(!isControlExpanded)} className="text-purple-600 hover:text-purple-800 flex items-center gap-1 text-lg">
                {isControlExpanded ? (
                  <>
                    <FiChevronUp /> Ocultar
                  </>
                ) : (
                  <>
                    <FiChevronDown /> Mostrar
                  </>
                )}
              </button>
            </div>

            {isControlExpanded && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <div className="mt-4">
                  <div className="flex flex-col sm:flex-row gap-4 items-end">
                    <div className="flex-grow">
                      <label htmlFor="year" className="block text-lg font-medium text-gray-700 mb-1">
                        Fecha de registro
                      </label>
                      <div className="flex items-center gap-4">
                        <select
                          id="year"
                          value={selectedYear}
                          onChange={(e) => setSelectedYear(Number(e.target.value))}
                          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-lg text-gray-800 focus:outline-0 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        >
                          {years.map((year) => (
                            <option key={year} value={year}>
                              {year}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="text-sm text-gray-500 mt-1">Filtra los datos según la fecha de registro.</div>
                    </div>
                    <button
                      onClick={() => handleActualizarDatos()}
                      disabled={status.type === "loading"}
                      className={`px-6 py-2.5 rounded-md font-semibold text-white text-base transition-colors flex items-center gap-2 ${
                        status.type === "loading" ? "bg-purple-400 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-700"
                      }`}
                    >
                      {status.type === "loading" ? (
                        <>
                          <FiRefreshCw className="animate-spin h-5 w-5" />
                          Cargando...
                        </>
                      ) : (
                        <>
                          <FiRefreshCw />
                          Actualizar datos
                        </>
                      )}
                    </button>
                  </div>
                  <DataStatus status={status} />
                </div>
              </motion.div>
            )}
          </div>
        </motion.section>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6">
            {activeTab === "metrics" && (
              <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                <h3 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center gap-2">
                  <FiBarChart2 className="text-purple-600" />
                  Métricas clave
                </h3>
                {metricas ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
                    <MetricCard title="Total proyectos" value={metricas.formularios} icon={<FiList className="text-blue-500" />} trend="neutral" />
                    <MetricCard title="Nivel inglés más común" value={metricas.nivel_ingles_mas_comun} icon={<FiUser className="text-cyan-500" />} trend="neutral" />
                    <MetricCard title="TRL máximo" value={metricas.trl_max} icon={<FaRocket className="text-purple-500" />} trend="neutral" />
                    <MetricCard title="Aprobados" value={metricas.aprobados} icon={<FiCheckCircle className="text-green-500" />} trend="up" />
                    <MetricCard title="Con docente" value={metricas.docente_si} icon={<FiUser className="text-amber-500" />} trend="up" />
                    <MetricCard title="Sin docente" value={metricas.docente_no} icon={<FiUser className="text-amber-500" />} trend="up" />
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg">
                    {status.type === "idle" ? "Actualiza los datos para ver métricas" : "No hay datos disponibles"}
                  </div>
                )}
                {proyectos.length > 0 && <Top10ProjectsView proyectos={proyectos} year={selectedYear} onRefresh={handleRefrescarVista} />}
              </motion.section>
            )}

            {activeTab === "charts" && (
              <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                <ChartSection graficos={graficos} />
              </motion.section>
            )}

            {activeTab === "search" && (
              <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                <ProjectSearch year={selectedYear} />
              </motion.section>
            )}

            {activeTab === "projects-table" && (
              <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                {proyectos.length > 0 ? (
                  <ProjectsTable
                    proyectos={proyectos}
                    currentPage={currentPage}
                    itemsPerPage={itemsPerPage}
                    setCurrentPage={setCurrentPage}
                    year={selectedYear}
                    onRefresh={handleRefrescarVista}
                  />
                ) : (
                  <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg">
                    {status.type === "idle" ? "Actualiza los datos para ver los proyectos" : "No hay datos disponibles"}
                  </div>
                )}
              </motion.section>
            )}

            {activeTab === "restore-deleted" && (
              <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                <h3 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center gap-2">
                  <FiRotateCcw className="text-purple-600" />
                  Restablecer proyectos
                </h3>
                <RestoreDeletedProjects year={selectedYear} onRefresh={handleRefrescarVista} />
              </motion.section>
            )}

            {activeTab === "insights" && (
              <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                <h3 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center gap-2">
                  <FiZap className="text-purple-600" />
                  Insights generales
                </h3>
                {insights ? (
                  <GeneralInsights data={insights} />
                ) : (
                  <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg">
                    {status.type === "idle" ? "Actualiza los datos para ver insights" : "No hay insights disponibles"}
                  </div>
                )}
              </motion.section>
            )}
          </div>
        </div>
      </motion.main>
    </div>
  );
};

export default TrlDashboard;
