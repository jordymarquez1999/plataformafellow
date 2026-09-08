import React from "react";

interface MetricCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  trend: "up" | "down" | "neutral";
}

const trendColors = {
  up: "text-green-500",
  down: "text-red-500",
  neutral: "text-gray-400",
};

const trendSymbols = {
  up: "^",
  down: "v",
  neutral: "",
};

const MetricCard: React.FC<MetricCardProps> = ({ title, value, icon, trend }) => {
  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:scale-[1.02] transition-all duration-200">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-base font-semibold text-black">{title}</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
        </div>
        <span className="text-3xl">{icon}</span>
      </div>
      <div className="mt-2 flex items-center">
        {trend !== "neutral" && (
          <span className={`text-xl ${trendColors[trend]} font-bold`}>
            {trendSymbols[trend]}
          </span>
        )}
      </div>
    </div>
  );
};

export default MetricCard;
