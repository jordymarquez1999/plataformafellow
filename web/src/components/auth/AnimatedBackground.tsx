import { useEffect, useState } from "react";

type Sparkle = { id: number; x: number; y: number; size: number; duration: number; delay: number };

export default function AnimatedBackground() {
  const [sparkles, setSparkles] = useState<Sparkle[]>([]);

  useEffect(() => {
    const arr: Sparkle[] = [];
    for (let i = 0; i < 40; i++) {
      arr.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 6 + 3,
        duration: Math.random() * 5 + 4,
        delay: Math.random() * 5,
      });
    }
    setSparkles(arr);
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="absolute inset-0" style={{ background: "var(--gradient-background, radial-gradient(circle at 20% 20%, #0f172a, #0b0f18 60%))" }} />
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />
      <div className="absolute inset-0">
        {sparkles.map((s) => (
          <div
            key={s.id}
            className="sparkle"
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              animationDuration: `${s.duration}s`,
              animationDelay: `${s.delay}s`,
            }}
          />
        ))}
      </div>
      <div className="absolute inset-0">
        <div className="light-ray light-ray-1" />
        <div className="light-ray light-ray-2" />
        <div className="light-ray light-ray-3" />
      </div>
    </div>
  );
}
