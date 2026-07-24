'use client'

import { useEffect, useRef } from 'react'

interface TickerItem {
  label: string
  value: string
  unit?: string
}

interface LiveTickerProps {
  items: TickerItem[]
}

export default function LiveTicker({ items }: LiveTickerProps) {
  const doubled = [...items, ...items]

  return (
    <div className="relative w-full overflow-hidden bg-obsidian-800 border-y border-cyber-green/10 py-3">
      {/* Left fade */}
      <div className="absolute left-0 top-0 h-full w-20 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to right, #0F1317, transparent)' }} />
      {/* Right fade */}
      <div className="absolute right-0 top-0 h-full w-20 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to left, #0F1317, transparent)' }} />

      <div className="flex animate-ticker whitespace-nowrap" style={{ animationDuration: '40s' }}>
        {doubled.map((item, i) => (
          <div key={i} className="flex items-center gap-3 mx-8 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-cyber-green animate-pulse-cyber" />
            <span className="text-sm text-white/50 font-medium">{item.label}</span>
            <span className="text-sm font-bold text-cyber-green font-mono">
              {item.value}
              {item.unit && <span className="text-white/40 font-normal ml-1">{item.unit}</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
