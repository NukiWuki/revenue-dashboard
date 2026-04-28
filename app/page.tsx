'use client'
import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { supabase } from '../lib/supabase'
import { createClient } from '../lib/supabase-browser'
import { useRouter } from 'next/navigation'

type Source = {
  id: string
  name: string
  category: string
  revenue: number
  losses: number
  status: string
}

const monthly = [
  { month: 'Ноя', revenue: 720, losses: 160 },
  { month: 'Дек', revenue: 810, losses: 200 },
  { month: 'Янв', revenue: 650, losses: 175 },
  { month: 'Фев', revenue: 880, losses: 195 },
  { month: 'Мар', revenue: 920, losses: 210 },
  { month: 'Апр', revenue: 840, losses: 200 },
]

const COLORS = ['#185FA5', '#1D9E75', '#BA7517', '#7F77DD']

const statusLabel: Record<string, string> = {
  healthy: 'Норма', watch: 'Внимание', at_risk: 'Риск'
}
const statusColor: Record<string, string> = {
  healthy: 'bg-green-100 text-green-800',
  watch: 'bg-yellow-100 text-yellow-800',
  at_risk: 'bg-red-100 text-red-800',
}

export default function Dashboard() {
  const [period, setPeriod] = useState('6m')
  const [sources, setSources] = useState<Source[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabaseAuth = createClient()

  // Проверка авторизации
  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabaseAuth.auth.getUser()
      if (!user) router.push('/login')
    }
    checkAuth()
  }, [])

  // Загрузка данных
  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.from('sources').select('*')
      if (!error && data) setSources(data)
      setLoading(false)
    }
    load()
  }, [])

  const totalRevenue = sources.reduce((s, r) => s + r.revenue, 0)
  const totalLosses = sources.reduce((s, r) => s + r.losses, 0)
  const netMargin = totalRevenue > 0
    ? (((totalRevenue - totalLosses) / totalRevenue) * 100).toFixed(1)
    : '0.0'

  const donut = sources.map(s => ({
    name: s.name,
    value: Math.round((s.revenue / totalRevenue) * 100)
  }))

  if (loading) return (
    <main className="p-6 flex items-center justify-center min-h-screen">
      <p className="text-gray-400">Загрузка данных...</p>
    </main>
  )

  return (
    <main className="p-6 max-w-5xl mx-auto">

      {/* Шапка */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-medium">Дашборд доходов и потерь</h1>
        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={e => setPeriod(e.target.value)}
            className="text-sm border rounded px-2 py-1"
          >
            <option value="6m">Последние 6 месяцев</option>
            <option value="q">Квартал</option>
            <option value="ytd">С начала года</option>
          </select>
          <button
            onClick={async () => {
              await supabaseAuth.auth.signOut()
              router.push('/login')
            }}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            Выйти
          </button>
        </div>
      </div>

      {/* Метрики */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Общий доход',  value: `$${totalRevenue.toLocaleString()}K` },
          { label: 'Общие потери', value: `$${totalLosses.toLocaleString()}K`  },
          { label: 'Чистая маржа', value: `${netMargin}%`                      },
          { label: 'Источников',  value: sources.length.toString()             },
        ].map(m => (
          <div key={m.label} className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">{m.label}</p>
            <p className="text-2xl font-medium">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Графики */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="border rounded-xl p-4">
          <p className="text-sm font-medium mb-3">Доходы vs потери — по месяцам</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthly}>
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `$${v}K`} />
              <Tooltip formatter={(v: number) => `$${v}K`} />
              <Bar dataKey="revenue" name="Доход"  fill="#185FA5" radius={[3,3,0,0]} />
              <Bar dataKey="losses"  name="Потери" fill="#D85A30" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="border rounded-xl p-4">
          <p className="text-sm font-medium mb-3">Доля по источникам</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={donut} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value">
                {donut.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Legend />
              <Tooltip formatter={(v: number) => `${v}%`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Таблица */}
      <div className="border rounded-xl p-4">
        <p className="text-sm font-medium mb-3">Разбивка по источникам</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 border-b">
              <th className="text-left pb-2">Источник</th>
              <th className="text-left pb-2">Категория</th>
              <th className="text-right pb-2">Доход</th>
              <th className="text-right pb-2">Потери</th>
              <th className="text-right pb-2">Нетто</th>
              <th className="text-left pb-2 pl-3">Статус</th>
            </tr>
          </thead>
          <tbody>
            {sources.map(s => (
              <tr key={s.id} className="border-b last:border-0">
                <td className="py-2">{s.name}</td>
                <td className="py-2 text-gray-400">{s.category}</td>
                <td className="py-2 text-right">${s.revenue}K</td>
                <td className="py-2 text-right">${s.losses}K</td>
                <td className="py-2 text-right">${s.revenue - s.losses}K</td>
                <td className="py-2 pl-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${statusColor[s.status]}`}>
                    {statusLabel[s.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </main>
  )
}