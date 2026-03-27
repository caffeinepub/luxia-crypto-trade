import { motion } from "motion/react";

export default function FounderPage() {
  return (
    <div className="min-h-screen bg-white py-16 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <div className="text-[#B8902A] text-xs tracking-widest uppercase font-semibold mb-3">
            Trezaria International
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-[#0A1628] uppercase tracking-tight">
            The Founder
          </h1>
          <div className="mt-4 w-16 h-0.5 bg-gradient-to-r from-[#C9A84C] to-[#E8C97A] mx-auto" />
        </motion.div>

        {/* Main card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="luxury-card overflow-hidden"
        >
          <div className="grid grid-cols-1 md:grid-cols-5 gap-0">
            {/* Photo column */}
            <div className="md:col-span-2 relative">
              <div className="relative h-80 md:h-full min-h-[320px] bg-gradient-to-br from-[#0A1628] to-[#1a3558]">
                <img
                  src="/assets/uploads/img_7311-019d2f63-aa70-77e6-a494-e7256e2b52e4-1.jpeg"
                  alt="Malverin Stonehart"
                  className="w-full h-full object-cover object-top mix-blend-luminosity opacity-90"
                />
                {/* Gold overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0A1628]/80 via-transparent to-transparent" />
                {/* Name badge */}
                <div className="absolute bottom-6 left-6 right-6">
                  <div className="text-[#C9A84C] text-xs tracking-widest uppercase font-semibold mb-1">
                    Founder & CEO
                  </div>
                  <div className="text-white font-display font-bold text-2xl">
                    Malverin Stonehart
                  </div>
                </div>
              </div>
            </div>

            {/* Content column */}
            <div className="md:col-span-3 p-8 md:p-12 flex flex-col justify-center">
              <div className="mb-6">
                <span className="inline-block px-3 py-1 rounded-full bg-[#0A1628]/6 border border-[#0A1628]/12 text-[#0A1628] text-xs font-bold tracking-widest uppercase">
                  Trezaria International
                </span>
              </div>

              <h2 className="font-display text-3xl font-bold text-[#0A1628] mb-2">
                Malverin Stonehart
              </h2>
              <p className="text-[#B8902A] text-sm font-semibold tracking-wider uppercase mb-6">
                Founder & Chief Executive Officer
              </p>

              <div className="space-y-4 text-[#0A1628]/70 leading-relaxed">
                <p>
                  Malverin Stonehart is the Founder and Chief Executive Officer
                  of <strong className="text-[#0A1628]">Trezaria</strong>, a
                  diversified international business group operating across
                  multiple industries including trading, digital assets,
                  precious metals, real estate, and investment solutions.
                </p>
                <p>
                  As a young and forward-thinking entrepreneur, Malverin
                  represents a new generation of business leaders driven by
                  innovation, strategic vision, and global ambition. His
                  approach to business is rooted in adaptability, modern
                  technology, and long-term value creation.
                </p>
              </div>

              {/* Gold divider */}
              <div className="my-6 h-px bg-gradient-to-r from-[#C9A84C]/30 via-[#C9A84C]/60 to-transparent" />

              <h3 className="font-display text-xl font-bold text-[#0A1628] mb-4">
                Vision & Leadership
              </h3>
              <p className="text-[#0A1628]/70 leading-relaxed">
                From the early stages of his career, Malverin demonstrated a
                strong entrepreneurial mindset and a deep interest in building
                scalable, future-focused ventures. Through Trezaria, he has
                established a platform designed to support business growth,
                investment opportunities, and market expansion on a global
                scale. His leadership style combines analytical thinking with
                creative execution, enabling the company to identify emerging
                opportunities and respond effectively to dynamic market
                conditions.
              </p>

              {/* CTA */}
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="https://www.instagram.com/malverin_stonehart?igsh=emUwMWVkOHY3bWMz&utm_source=qr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-gold px-6 py-3 rounded-xl text-sm font-bold tracking-wider uppercase inline-flex items-center gap-2"
                >
                  <span>📸</span> Order Trading Access
                </a>
              </div>
              <p className="text-[#0A1628]/40 text-xs mt-2">
                To activate your account, message on Instagram
              </p>
            </div>
          </div>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="grid grid-cols-3 gap-4 mt-8"
        >
          {[
            {
              label: "Industries",
              value: "5+",
              desc: "Trading, Digital Assets, Precious Metals, Real Estate, Investments",
            },
            {
              label: "Global Reach",
              value: "Int'l",
              desc: "Operating across multiple international markets",
            },
            {
              label: "Vision",
              value: "2025+",
              desc: "Long-term value creation and market leadership",
            },
          ].map((stat) => (
            <div key={stat.label} className="luxury-card p-6 text-center">
              <div className="text-[#B8902A] font-display font-bold text-3xl mb-1">
                {stat.value}
              </div>
              <div className="text-[#0A1628] font-bold text-sm uppercase tracking-wider mb-2">
                {stat.label}
              </div>
              <div className="text-[#0A1628]/50 text-xs leading-relaxed hidden sm:block">
                {stat.desc}
              </div>
            </div>
          ))}
        </motion.div>

        {/* Footer */}
        <div className="mt-16 text-center border-t border-[#0A1628]/8 pt-8">
          <p className="text-[#0A1628]/30 text-xs">
            &copy; {new Date().getFullYear()}. Built with love using{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#B8902A] transition-colors"
            >
              caffeine.ai
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
