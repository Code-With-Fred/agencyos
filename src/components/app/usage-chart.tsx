'use client'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export function UsageChart({ data }: { data: { day: string; ai: number; audits: number }[] }) {
  const empty = data.every((d) => d.ai === 0 && d.audits === 0)
  return (
    <div className="relative h-56 w-full">
      {empty ? <p className="absolute inset-0 z-10 flex items-center justify-center text-[13px] text-fg-subtle">No AI generations or audits in the last 30 days.</p> : null}
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
          <defs>
            <linearGradient id="g-ai" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6d6af5" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#6d6af5" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="g-audits" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#232329" vertical={false} />
          <XAxis dataKey="day" tickFormatter={(d: string) => d.slice(5)} tick={{ fill: '#6b6b76', fontSize: 11 }} axisLine={false} tickLine={false} interval={6} />
          <YAxis allowDecimals={false} tick={{ fill: '#6b6b76', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ stroke: '#31313a' }}
            contentStyle={{ background: '#1b1b20', border: '1px solid #31313a', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#a0a0ab' }}
          />
          <Area type="monotone" dataKey="ai" name="AI generations" stroke="#6d6af5" strokeWidth={1.5} fill="url(#g-ai)" />
          <Area type="monotone" dataKey="audits" name="Audits" stroke="#38bdf8" strokeWidth={1.5} fill="url(#g-audits)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
