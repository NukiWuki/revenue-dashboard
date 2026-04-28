'use client'
import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
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

const emptyForm = { name: '', category: '', revenue: 0, losses: 0, status: 'healthy' }

const monthly = [
  { month: 'Ноя', revenue: 720, losses: 160 },
  { month: 'Дек', revenue: 810, losses: 200 },
  { month: 'Янв', revenue: 650, losses: 175 },
  { month: 'Фев', revenue: 880, losses: 195 },
  { month: 'Мар', revenue: 920, losses: 210 },
  { month: 'Апр', revenue: 840, losses: 200 },
]

const COLORS = ['#185FA5', '#1D9E75', '#BA7517', '#7F77DD', '#D85A30', '#E05C9A']
const statusLabel: Record<string, string> = { healthy: 'Норма', watch: 'Внимание', at_risk: 'Риск' }
const statusColor: Record<string, string> = {
  healthy: 'bg-green-100 text-green-800',
  watch: 'bg-yellow-100 text-yellow-800',
  at_risk: 'bg-red-100 text-red-800',
}

export default function Dashboard() {
  const [period, setPeriod] = useState('6m')
  const [sources, setSources] = useState<Source[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabaseAuth = createClient()

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabaseAuth.auth.getUser()
      if (!user) router.push('/login')
    }
    checkAuth()
  }, [])

  async function load() {
    const { data, error } = await supabase.from('sources').select('*')
    if (!error && data) setSources(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openAdd() {
    setForm(emptyForm)
    setEditingId(null)
    setShowForm(true)
  }

  function openEdit(s: Source) {
    setForm({ name: s.name, category: s.category, revenue: s.revenue, losses: s.losses, status: s.status })
    setEditingId(s.id)
    setShowForm(true)
  }

  async function handleSave() {
    setSaving(true)
    if (editingId) {
      await supabase.from('sources').update(form).eq('id', editingId)
    } else {
      await supabase.from('sources').insert(form)
    }
    await load()
    setShowForm(false)
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить этот источник?')) return
    await supabase.from('sources').delete().eq('id', id)
    await load()
  }

  const totalRevenue = sources.reduce((s, r) => s + r.revenue, 0)
  const totalLosses = sources.reduce((s, r) => s + r.losses, 0)
  const netMargin = totalRevenue > 0 ? (((totalRevenue - totalLosses) / totalRevenue) * 100).toFixed(1) : '0.0'
  const donut = sources.map(s => ({ name: s.name, value: Math.round((s.revenue / totalRevenue) * 100) }))

  if (loading) return (
    <main className="p-6 flex items-center justify-center min-h-screen">
      <p className="text-gray-500">Загрузка данных...</p>
    </main>
  )

  return (
    <main className="p-6 max-w-5xl mx-auto" style={{ color: '#111' }}>

      {/* Модальная форма */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-medium mb-4 text-gray-900">
              {editingId ? 'Редактировать источник' : 'Добавить источник'}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Название</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white" value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Категория</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white" value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Доход (K)</label>
                  <input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white" value={form.revenue}
                    onChange={e => setForm({ ...form, revenue: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Потери (K)</label>
                  <input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white" value={form.losses}
                    onChange={e => setForm({ ...form, losses: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Статус</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white" value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value })}>
                  <option value="healthy">Норма</option>
                  <option value="watch">Внимание</option>
                  <option value="at_risk">Риск</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button onClick={() => setShowForm(false)}
                className="flex-1 border border-gray-300 rounded-lg py-2 text-sm text-gray-700 hover:bg-gray-50">
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Шапка */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-medium text-gray-900">Дашборд доходов и потерь</h1>
        <div className="flex items-center gap-3">
          <select value={period} onChange={e => setPeriod(e.target.value)}
            className="text-sm border border-gray-300 rounded px-2 py-1 text-gray-900 bg-white">
            <option value="6m">Последние 6 месяцев</option>
            <option value="q">Квартал</option>
            <option value="ytd">С начала года</option>
          </select>
          <button onClick={async () => { await supabaseAuth.auth.signOut(); router.push('/login') }}
            className="text-sm text-gray-500 hover:text-gray-800">
            Выйти
          </button>
        </div>
      </div>

      {/* Метрики */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Общий доход',  value: `$${totalRevenue.toLocaleString()}K` },
          { label: 'Общие потери', value: `$${totalLosses.toLocaleString()}K` },
          { label: 'Чистая маржа', value: `${netMargin}%` },
          { label: 'Источников',  value: sources.length.toString() },
        ].map(m => (
          <div key={m.label} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">{m.label}</p>
            <p className="text-2xl font-medium text-gray-900">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Графики */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="border border-gray-200 rounded-xl p-4 bg-white">
          <p className="text-sm font-medium mb-3 text-gray-900">Доходы vs потери — по месяцам</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthly}>
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#555' }} />
              <YAxis tick={{ fontSize: 12, fill: '#555' }} tickFormatter={v => `$${v}K`} />
              <Tooltip formatter={(v) => `$${v}K`} />
              <Bar dataKey="revenue" name="Доход"  fill="#185FA5" radius={[3,3,0,0]} />
              <Bar dataKey="losses"  name="Потери" fill="#D85A30" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="border border-gray-200 rounded-xl p-4 bg-white">
          <p className="text-sm font-medium mb-2 text-gray-900">Доля по источникам</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={donut} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value">
                {donut.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => `${v}%`} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
            {donut.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="text-xs text-gray-600">{d.name} {d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Таблица */}
      <div className="border border-gray-200 rounded-xl p-4 bg-white">
        <div className="flex justify-between items-center mb-3">
          <p className="text-sm font-medium text-gray-900">Разбивка по источникам</p>
          <button onClick={openAdd}
            className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">
            + Добавить
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 border-b border-gray-200">
              <th className="text-left pb-2">Источник</th>
              <th className="text-left pb-2">Категория</th>
              <th className="text-right pb-2">Доход</th>
              <th className="text-right pb-2">Потери</th>
              <th className="text-right pb-2">Нетто</th>
              <th className="text-left pb-2 pl-3">Статус</th>
              <th className="text-right pb-2">Действия</th>
            </tr>
          </thead>
          <tbody>
            {sources.map(s => (
              <tr key={s.id} className="border-b border-gray-100 last:border-0">
                <td className="py-2 text-gray-900">{s.name}</td>
                <td className="py-2 text-gray-500">{s.category}</td>
                <td className="py-2 text-right text-gray-900">${s.revenue}K</td>
                <td className="py-2 text-right text-gray-900">${s.losses}K</td>
                <td className="py-2 text-right text-gray-900">${s.revenue - s.losses}K</td>
                <td className="py-2 pl-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${statusColor[s.status]}`}>
                    {statusLabel[s.status]}
                  </span>
                </td>
                <td className="py-2 text-right">
                  <button onClick={() => openEdit(s)} className="text-xs text-blue-500 hover:text-blue-700 mr-2">
                    Изменить
                  </button>
                  <button onClick={() => handleDelete(s.id)} className="text-xs text-red-400 hover:text-red-600">
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </main>
  )
}