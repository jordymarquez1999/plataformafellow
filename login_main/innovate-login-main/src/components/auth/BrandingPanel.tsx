import { Lightbulb, Target, BarChart3, Shield } from 'lucide-react';

const features = [
  { icon: Lightbulb, text: 'Rúbricas inteligentes' },
  { icon: Target, text: 'Evaluación por etapas' },
  { icon: BarChart3, text: 'Panel de avances' },
  { icon: Shield, text: 'Transparencia total' },
];

const BrandingPanel = () => {
  return (
    <div className="flex flex-col justify-center p-8 lg:p-12">
      {/* Logo / Brand */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <Lightbulb className="w-5 h-5 text-primary-foreground" />
          </div>
        </div>
        <h1 className="font-display text-3xl lg:text-4xl font-bold text-foreground mb-2">
          Plataforma de Innovación
        </h1>
        <p className="text-muted-foreground text-lg">
          Concurso de proyectos innovadores
        </p>
      </div>

      {/* Inspirational copy */}
      <div className="space-y-6">
        <p className="text-xl lg:text-2xl font-medium text-foreground/90 leading-relaxed">
          Donde las ideas se convierten en{' '}
          <span className="gradient-text font-semibold">propuestas ganadoras.</span>
        </p>

        {/* Feature list */}
        <ul className="space-y-4 mt-8">
          {features.map((feature, index) => (
            <li 
              key={feature.text}
              className="flex items-center gap-3 text-muted-foreground opacity-0 animate-fade-in"
              style={{ animationDelay: `${index * 100 + 200}ms` }}
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <feature.icon className="w-4 h-4 text-primary" />
              </div>
              <span>{feature.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default BrandingPanel;
