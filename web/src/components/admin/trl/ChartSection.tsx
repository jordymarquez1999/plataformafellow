import React, { useState, useEffect } from "react";
import Plot from "react-plotly.js";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ChartSectionProps {
  graficos: any;
}

const ChartSection: React.FC<ChartSectionProps> = ({ graficos }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const parseChartData = (chartData: string) => {
    try {
      return chartData ? JSON.parse(chartData) : null;
    } catch (error) {
      console.error("Error parsing chart data:", error);
      return null;
    }
  };

  const chartData = [
    { title: "Aprobados por Nivel TRL", data: parseChartData(graficos?.grafico_1) },
    { title: "Proyectos Aprobados", data: parseChartData(graficos?.grafico_2) },
    { title: "Aprobación por TRL", data: parseChartData(graficos?.grafico_3) },
    { title: "Puntajes TRL 1-3", data: parseChartData(graficos?.grafico_4) },
    { title: "Proyectos por Industria", data: parseChartData(graficos?.grafico_5) },
    { title: "Nivel de Inglés", data: parseChartData(graficos?.grafico_6) },
    { title: "Ubicacion Geografica", data: parseChartData(graficos?.grafico_7) },
  ];

  const slidesPerView = isMobile ? 1 : 2;
  const totalSlides = Math.ceil(chartData.length / slidesPerView);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev === totalSlides - 1 ? 0 : prev + 1));
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev === 0 ? totalSlides - 1 : prev - 1));
  };

  return (
    <div className="relative">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg sm:text-xl font-semibold text-gray-800">Visualizacion de datos</h3>
        <div className="flex space-x-2">
          <button onClick={prevSlide} className="p-2 hover:bg-gray-200 rounded-full" aria-label="Anterior">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <button onClick={nextSlide} className="p-2 hover:bg-gray-200 rounded-full" aria-label="Siguiente">
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      <div className="overflow-hidden">
        <div className="flex transition-transform duration-300 ease-in-out" style={{ transform: `translateX(-${currentSlide * 100}%)` }}>
          {Array.from({ length: totalSlides }).map((_, slideIndex) => (
            <div key={slideIndex} className="w-full flex-shrink-0 flex flex-col sm:flex-row gap-6">
              {chartData
                .slice(slideIndex * slidesPerView, (slideIndex + 1) * slidesPerView)
                .map((chart, idx) => (
                  <div key={idx} className="flex-1 bg-white p-4 sm:p-6 rounded-xl shadow-md border border-gray-200">
                    <h4 className="text-base sm:text-lg font-medium text-gray-800 mb-3 truncate">{chart.title}</h4>
                    <div className="h-[350px] sm:h-[450px] w-full">
                      {chart.data ? (
                        <Plot
                          data={chart.data.data}
                          layout={{
                            ...chart.data.layout,
                            width: null,
                            height: isMobile ? 350 : 450,
                            autosize: true,
                          }}
                          config={{ responsive: true, displayModeBar: false }}
                          style={{ width: "100%", height: "100%" }}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-400">Datos no disponibles</div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-center mt-4 space-x-2">
        {Array.from({ length: totalSlides }).map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            className={`w-3 h-3 rounded-full ${currentSlide === index ? "bg-purple-600" : "bg-gray-300"}`}
          />
        ))}
      </div>
    </div>
  );
};

export default ChartSection;
