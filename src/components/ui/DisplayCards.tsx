import { motion } from "framer-motion";

interface DisplayCardProps {
  className?: string;
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  sub?: string;
  color?: string;
  delay?: number;
}

export function DisplayCard({
  icon,
  title = "Featured",
  description = "Discover amazing content",
  sub = "Just now",
  color = "#A78BFA",
  delay = 0,
  className = "",
}: DisplayCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -6, scale: 1.02 }}
      className={`relative flex h-32 w-80 select-none flex-col justify-between rounded-2xl px-5 py-4 backdrop-blur-sm transition-all duration-500 ${className}`}
      style={{
        background: `${color}0D`,
        border: `1px solid ${color}28`,
        transform: "skewY(-4deg)",
      }}
    >
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: `${color}20`, border: `1px solid ${color}30` }}
        >
          {icon}
        </div>
        <p className="font-display font-black text-sm" style={{ color, letterSpacing: "-0.02em" }}>{title}</p>
      </div>
      <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.75)" }}>{description}</p>
      <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.28)" }}>{sub}</p>
      {/* Right fade */}
      <div className="absolute right-0 top-0 h-full w-24 rounded-r-2xl pointer-events-none"
        style={{ background: "linear-gradient(to right, transparent, #0F0F0F)" }}
      />
    </motion.div>
  );
}

interface DisplayCardsProps {
  cards: DisplayCardProps[];
}

export default function DisplayCards({ cards }: DisplayCardsProps) {
  return (
    <div className="relative" style={{ height: "200px" }}>
      {cards.map((card, i) => (
        <div key={i}
          className="absolute"
          style={{
            top: `${i * 28}px`,
            left: `${i * 36}px`,
            zIndex: cards.length - i,
          }}
        >
          <DisplayCard {...card} delay={i * 0.1} />
        </div>
      ))}
    </div>
  );
}
