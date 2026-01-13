import { useQuery } from '@tanstack/react-query'
import { listTokensMonitor } from '../api'
import { useMemo, useState } from 'react'
import { Shield, AlertTriangle, Clock, CheckCircle, RefreshCw } from 'lucide-react'

interface TokenItem {
  id: number
  token: string
  env: string
  expires_at: string
  created_at: string
  service_code: string
}

function daysLeft(expiresAt: string) {
  const exp = new Date(expiresAt).getTime()
  const now = Date.now()
  return Math.ceil((exp - now) / (24 * 3600 * 1000))
}

export default function TokensMonitorPage() {
  const tokensQ = useQuery({
    queryKey: ['tokens-monitor'],
    queryFn: async () => {
      const r = await listTokensMonitor({ days: 7 })
      return r.items as TokenItem[]
    }
  })

  const [showSoonOnly, setShowSoonOnly] = useState(false)

  const items = useMemo(() => {
    const list: TokenItem[] = tokensQ.data || []
    return showSoonOnly ? list.filter(it => daysLeft(it.expires_at) <= 7) : list
  }, [tokensQ.data, showSoonOnly])

  const total = tokensQ.data?.length || 0
  const soon = tokensQ.data ? tokensQ.data.filter((it: TokenItem) => daysLeft(it.expires_at) <= 7).length : 0

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold">Token 有效期监控</h2>
          </div>
          <button
            className="flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 shadow-sm"
            onClick={() => {
              servicesQ.refetch()
              tokensQ.refetch()
            }}
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${tokensQ.isFetching ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>
        <p className="text-sm text-gray-600 mt-1">展示全部服务的拉取 Token 及其有效期，便于及时轮换。</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-100">
          <div className="flex items-center gap-2 text-gray-600"><CheckCircle className="w-4 h-4" />总Token数</div>
          <div className="text-2xl font-bold mt-2">{total}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-100">
          <div className="flex items-center gap-2 text-gray-600"><AlertTriangle className="w-4 h-4 text-orange-500" />7天内到期</div>
          <div className="text-2xl font-bold mt-2 text-orange-600">{soon}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-100">
          <div className="flex items-center gap-2 text-gray-600"><Clock className="w-4 h-4" />筛选</div>
          <label className="mt-2 inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showSoonOnly} onChange={e=>setShowSoonOnly(e.target.checked)} />
            仅显示7天内到期
          </label>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow">
        <div className="overflow-hidden border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr className="text-left text-gray-600">
                <th className="p-3 font-medium">服务</th>
                <th className="p-3 font-medium">环境</th>
                <th className="p-3 font-medium">创建时间</th>
                <th className="p-3 font-medium">到期时间</th>
                <th className="p-3 font-medium">剩余天数</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map(it => {
                const left = daysLeft(it.expires_at)
                const danger = left <= 7
                return (
                  <tr key={`${it.service_code}-${it.id}`} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-3 font-mono">{it.service_code}</td>
                    <td className="p-3 font-mono">{it.env}</td>
                    <td className="p-3">{new Date(it.created_at).toLocaleString()}</td>
                    <td className="p-3">{new Date(it.expires_at).toLocaleString()}</td>
                    <td className={`p-3 font-semibold ${danger ? 'text-orange-600' : 'text-gray-700'}`}>
                      {left} 天
                    </td>
                  </tr>
                )
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-gray-400">暂无数据</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
