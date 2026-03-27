import { motion } from "motion/react";

interface Props {
  title: string;
  subtitle: string;
  icon: string;
}

export default function PlaceholderPage({ title, subtitle, icon }: Props) {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center max-w-md"
      >
        <div className="text-6xl mb-6">{icon}</div>
        <div className="w-16 h-0.5 bg-gradient-to-r from-[#C9A84C] to-[#E8C97A] mx-auto mb-6" />
        <h1 className="font-display text-3xl font-bold text-[#0A1628] uppercase tracking-tight mb-3">
          {title}
        </h1>
        <p className="text-[#0A1628]/50 leading-relaxed">{subtitle}</p>
        <div className="mt-8 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#0A1628]/5 border border-[#0A1628]/10">
          <span className="w-2 h-2 rounded-full bg-[#C9A84C] animate-pulse" />
          <span className="text-[#0A1628]/60 text-xs font-semibold tracking-widest uppercase">
            Coming Soon
          </span>
        </div>
      </motion.div>
    </div>
  );
}
