import React from "react";
import { FiTrendingUp, FiAward, FiBarChart, FiInfo, FiZap } from "react-icons/fi";
import { motion } from "framer-motion";

type TopProyecto = {
  "Nombre del Proyecto": string;
  "Puntaje Total": number;
};

interface InsightsGenerales {
  metricas: {
    total_proyectos: number;
    aprobados: number;
    porcentaje_aprobados: number;
    distribucion_trl: Record<string, number>;
    promedios: {
      "TRL 1-3": number;
      "TRL 4-7": number;
      "TRL 8-9": number;
      Total: number;
    };
  };
  top_proyectos: TopProyecto[];
  insights: string[];
}

interface Props {
  data: InsightsGenerales;
}

const GeneralInsights: React.FC<Props> = ({ data }) => {
  return (
    <motion.div className="space-y-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <motion.div className="bg-purple-50 border border-purple-200 rounded-xl p-6 shadow-sm" whileHover={{ scale: 1.02 }} transition={{ duration: 0.2 }}>
          <h4 className="text-xl text-purple-800 font-semibold flex items-center gap-2 mb-2">
            <FiTrendingUp />
            Estado de aprobación
          </h4>
          <p className="text-purple-900 text-lg">
            <strong>{data.metricas.aprobados}</strong> de <strong>{data.metricas.total_proyectos}</strong> proyectos aprobados
          </p>
          <p className="text-base text-purple-700 mt-1">({data.metricas.porcentaje_aprobados.toFixed(1)}%)</p>
        </motion.div>

        <motion.div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 shadow-sm" whileHover={{ scale: 1.02 }} transition={{ duration: 0.2 }}>
          <h4 className="text-xl text-yellow-800 font-semibold flex items-center gap-2 mb-4">
            <FiAward />
            Proyectos destacados
          </h4>
          <ul className="divide-y divide-yellow-100">
            {data.top_proyectos.map((p, index) => (
              <li key={index} className="flex items-start justify-between py-2 gap-4">
                <span className="text-yellow-900 font-medium leading-snug">{p["Nombre del Proyecto"]}</span>
                <span className="text-yellow-700 font-semibold whitespace-nowrap">{p["Puntaje Total"]} pts</span>
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div className="bg-blue-50 border border-blue-200 rounded-xl p-6 shadow-sm" whileHover={{ scale: 1.02 }} transition={{ duration: 0.2 }}>
          <h4 className="text-xl text-blue-800 font-semibold flex items-center gap-2 mb-2">
            <FiBarChart />
            Puntajes promedio
          </h4>
          <ul className="text-blue-900 space-y-1 text-base">
            {Object.entries(data.metricas.promedios).map(([key, val]) => (
              <li key={key}>
                {key}: <strong>{val.toFixed(1)}</strong>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>

      <motion.div className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
        <h4 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <FiInfo />
          Distribucion por segmento TRL
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-base text-gray-700">
          <div className="bg-gray-50 rounded-md p-4 text-center border">
            <span className="block text-2xl font-bold text-indigo-600">{data.metricas.distribucion_trl["TRL 1-3"] || 0}</span>
            Etapa inicial (TRL 1-3)
          </div>
          <div className="bg-gray-50 rounded-md p-4 text-center border">
            <span className="block text-2xl font-bold text-indigo-600">{data.metricas.distribucion_trl["TRL 4-7"] || 0}</span>
            En desarrollo (TRL 4-7)
          </div>
          <div className="bg-gray-50 rounded-md p-4 text-center border">
            <span className="block text-2xl font-bold text-indigo-600">{data.metricas.distribucion_trl["TRL 8-9"] || 0}</span>
            Cerca de implementación (TRL 8-9)
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm">
        <h4 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <FiZap />
          Insights generales
        </h4>
        <ul className="list-disc pl-6 space-y-3 text-gray-700 text-base">
          {data.insights.map((linea, idx) => (
            <li key={idx}>{linea}</li>
          ))}
        </ul>
      </motion.div>
    </motion.div>
  );
};

export default GeneralInsights;
