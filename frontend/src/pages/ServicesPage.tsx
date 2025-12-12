import { useMutation, useQuery } from '@tanstack/react-query'
import { createService, listServices } from '../api'
import { useState } from 'react'
import { Plus, Search, Server, User, Calendar, X, Key, Copy, Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function ServicesPage() {
  const navigate = useNavigate()
  const servicesQ = useQuery({ queryKey: ['services'], queryFn: listServices })
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ code: '', name: '', owner: '' })
  const [result, setResult] = useState<{ak: string, sk: string} | null>(null)
  
  const createM = useMutation({ 
    mutationFn: () => createService(form), 
    onSuccess: (d) => { 
      setResult(d);
      servicesQ.refetch();
    } 
  })

  const [search, setSearch] = useState('')
  const filtered = Array.isArray(servicesQ.data) 
    ? servicesQ.data.filter((s:any) => s.name.includes(search) || s.code.includes(search)) 
    : []

  const [copiedAK, setCopiedAK] = useState(false)
  const [copiedSK, setCopiedSK] = useState(false)

  const copy = (text: string, type: 'AK' | 'SK') => {
    navigator.clipboard.writeText(text)
    if (type === 'AK') { setCopiedAK(true); setTimeout(() => setCopiedAK(false), 2000) }
    else { setCopiedSK(true); setTimeout(() => setCopiedSK(false), 2000) }
  }

  const closeCreate = () => {
    setShowCreate(false)
    setForm({ code: '', name: '', owner: '' })
    setResult(null)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" 
            placeholder="搜索服务..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button 
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          onClick={() => setShowCreate(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          注册服务
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((s:any) => (
          <div 
            key={s.id} 
            className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
            onClick={() => navigate(`/services/${s.code}`)}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Server className="w-5 h-5" />
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                {s.active ? '运行中' : '已停用'}
              </span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{s.name}</h3>
            <p className="text-sm text-gray-500 mb-4 font-mono">{s.code}</p>
            
            <div className="flex items-center justify-between pt-4 border-t border-gray-50 text-sm text-gray-500">
              <div className="flex items-center">
                <User className="w-4 h-4 mr-1.5" />
                <span>{s.owner || '-'}</span>
              </div>
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-1.5" />
                <span>{new Date(s.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 relative">
            {!result ? (
              <>
                <button 
                  className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
                  onClick={closeCreate}
                >
                  <X className="w-5 h-5" />
                </button>
                <h3 className="text-xl font-bold mb-6">注册新服务</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">服务代号 (Code)</label>
                    <input 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g. payment-service"
                      value={form.code}
                      onChange={e => setForm({...form, code: e.target.value})}
                    />
                    <p className="text-xs text-gray-500 mt-1">全局唯一，注册后不可修改</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">服务名称</label>
                    <input 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g. 支付中心"
                      value={form.name}
                      onChange={e => setForm({...form, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">负责人</label>
                    <input 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g. 张三"
                      value={form.owner}
                      onChange={e => setForm({...form, owner: e.target.value})}
                    />
                  </div>
                </div>

                <div className="mt-8 flex justify-end gap-3">
                  <button 
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                    onClick={closeCreate}
                  >
                    取消
                  </button>
                  <button 
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => createM.mutate()}
                    disabled={!form.code || !form.name || createM.isPending}
                  >
                    {createM.isPending ? '提交中...' : '确认注册'}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">服务注册成功</h3>
                <p className="text-sm text-gray-500 mb-6">
                  请立即保存您的访问凭证 (SK)，出于安全考虑，它将只显示这一次。
                </p>
                
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-left space-y-3 mb-6">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Access Key (AK)</div>
                    <div className="flex items-center justify-between bg-white px-3 py-2 rounded border border-gray-200">
                      <code className="text-sm font-mono text-gray-800">{result.ak}</code>
                      <button onClick={() => copy(result.ak, 'AK')} className="text-gray-400 hover:text-blue-600 ml-2">
                        {copiedAK ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Secret Key (SK) - <span className="text-red-500">仅显示一次</span></div>
                    <div className="flex items-center justify-between bg-white px-3 py-2 rounded border border-gray-200">
                      <code className="text-sm font-mono text-gray-800 break-all">{result.sk}</code>
                      <button onClick={() => copy(result.sk, 'SK')} className="text-gray-400 hover:text-blue-600 ml-2">
                        {copiedSK ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <button 
                  className="w-full px-4 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 font-medium"
                  onClick={closeCreate}
                >
                  我已保存凭证
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
