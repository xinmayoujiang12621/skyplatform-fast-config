import { useQuery, useMutation } from '@tanstack/react-query'
import { listBackendBases, saveBackendBase, deleteBackendBase, BackendBase, API_BASE } from '../api'
import { useState } from 'react'
import { Server, RefreshCw, Plus, Trash2, Edit2, X, Save, Copy } from 'lucide-react'
import { useToast } from '../context/ToastContext'

export default function BackendBasePage() {
  const { showToast } = useToast()
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<{ appid: string; base_url: string; note: string }>({ appid: '', base_url: '', note: '' })
  const [isEdit, setIsEdit] = useState(false)

  const basesQ = useQuery({
    queryKey: ['backend-bases'],
    queryFn: listBackendBases
  })

  const saveM = useMutation({
    mutationFn: (data: { appid: string; base_url: string; note: string; updated_by?: string }) => 
      saveBackendBase({ ...data, updated_by: 'admin' }), // 简单起见，这里固定为admin，实际应取当前用户
    onSuccess: () => {
      setShowModal(false)
      setForm({ appid: '', base_url: '', note: '' })
      setIsEdit(false)
      basesQ.refetch()
      showToast('保存成功', 'success')
    },
    onError: (err: any) => {
      showToast(err.message || '保存失败', 'error')
    }
  })

  const deleteM = useMutation({
    mutationFn: (appid: string) => deleteBackendBase(appid),
    onSuccess: () => {
      basesQ.refetch()
      showToast('删除成功', 'success')
    },
    onError: (err: any) => {
      showToast(err.message || '删除失败', 'error')
    }
  })

  const handleEdit = (item: BackendBase) => {
    setForm({ appid: item.appid, base_url: item.base_url, note: item.note || '' })
    setIsEdit(true)
    setShowModal(true)
  }

  const handleDelete = (appid: string) => {
    if (confirm(`确定要删除 ${appid} 的映射吗？`)) {
      deleteM.mutate(appid)
    }
  }

  const handleSave = () => {
    if (!form.appid || !form.base_url) return
    saveM.mutate(form)
  }

  const handleCopyUrl = (appid: string) => {
    const url = `${API_BASE}/api/v1/meta/backend-base?appid=${appid}`
    navigator.clipboard.writeText(url).then(() => {
      showToast('已复制获取链接到剪贴板', 'success')
    }).catch(err => {
      console.error('Failed to copy:', err)
      showToast('复制失败，请手动复制', 'error')
    })
  }

  const items: BackendBase[] = basesQ.data || []

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg">
              <Server className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">后端地址映射</h2>
              <p className="text-sm text-gray-500 mt-0.5">管理 AppID 到后端服务地址的映射关系，便于前端动态切换后端。</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <button
              className="flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 shadow-sm"
              onClick={() => basesQ.refetch()}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${basesQ.isFetching ? 'animate-spin' : ''}`} />
              刷新
            </button>
            <button
              className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200"
              onClick={() => {
                setForm({ appid: '', base_url: '', note: '' })
                setIsEdit(false)
                setShowModal(true)
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              添加映射
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50/50 border-b border-gray-100">
              <tr className="text-gray-600">
                <th className="p-4 font-semibold w-48">AppID</th>
                <th className="p-4 font-semibold">后端地址 (Base URL)</th>
                <th className="p-4 font-semibold">备注</th>
                <th className="p-4 font-semibold w-40">更新人</th>
                <th className="p-4 font-semibold w-48">更新时间</th>
                <th className="p-4 font-semibold w-32 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map(item => (
                <tr key={item.appid} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="p-4 font-mono font-medium text-gray-900">{item.appid}</td>
                  <td className="p-4 font-mono text-gray-600">{item.base_url}</td>
                  <td className="p-4 text-gray-500">{item.note || '-'}</td>
                  <td className="p-4 text-gray-500">
                    <div className="flex items-center gap-2">
                       <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">
                         {(item.updated_by || '?')[0].toUpperCase()}
                       </span>
                       {item.updated_by || 'Unknown'}
                    </div>
                  </td>
                  <td className="p-4 text-gray-400 font-mono text-xs">
                    {new Date(item.updated_at).toLocaleString()}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleCopyUrl(item.appid)}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="复制获取链接"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(item)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="编辑"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.appid)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-gray-400 bg-gray-50/20">
                    <div className="flex flex-col items-center gap-3">
                      <Server className="w-10 h-10 text-gray-200" />
                      <p>暂无映射配置</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">
                {isEdit ? '编辑映射' : '添加映射'}
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">AppID</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all disabled:bg-gray-50 disabled:text-gray-500"
                  placeholder="e.g. my-app"
                  value={form.appid}
                  onChange={e => setForm({ ...form, appid: e.target.value })}
                  disabled={isEdit} // AppID acts as primary key in logic mostly
                />
                <p className="text-xs text-gray-400 mt-1">应用的唯一标识符</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">后端地址 (Base URL)</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                  placeholder="http://example.com:8000"
                  value={form.base_url}
                  onChange={e => setForm({ ...form, base_url: e.target.value })}
                />
                <p className="text-xs text-gray-400 mt-1">完整的后端服务根地址，包含协议和端口</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">备注 (可选)</label>
                <textarea
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all resize-none"
                  rows={3}
                  placeholder="描述该环境或用途..."
                  value={form.note}
                  onChange={e => setForm({ ...form, note: e.target.value })}
                />
              </div>
            </div>

            <div className="p-5 border-t border-gray-50 flex justify-end gap-3 bg-gray-50/50 rounded-b-xl">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saveM.isPending || !form.appid || !form.base_url}
                className="flex items-center px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {saveM.isPending ? (
                   <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                   <Save className="w-4 h-4 mr-2" />
                )}
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
