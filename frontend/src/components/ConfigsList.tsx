import { useMutation, useQuery } from '@tanstack/react-query'
import { createConfig, listConfigs, updateConfig } from '../api'
import { useEffect, useState, useMemo } from 'react'
import { Plus, X, Trash2, Edit2, Save } from 'lucide-react'

// Standard Environments

interface KvItem {
  key: string
  value: any
}

export default function ConfigsList({ serviceCode, env }: { serviceCode: string, env: string }) {
  const listQ = useQuery({ queryKey: ['cfgs', serviceCode, env], queryFn: () => listConfigs({ service: serviceCode, env }) })
  
  // 当前活跃的配置对象（后端返回的原始对象）
  const activeConfig = useMemo(() => {
    if (Array.isArray(listQ.data) && listQ.data.length > 0) {
      return listQ.data[0]
    }
    return null
  }, [listQ.data])

  // 解析出的 KV 列表
  const [kvList, setKvList] = useState<KvItem[]>([])

  useEffect(() => {
    if (activeConfig) {
      try {
        const obj = JSON.parse(activeConfig.content)
        const list = Object.entries(obj).map(([key, value]) => ({ key, value }))
        setKvList(list)
      } catch (e) {
        console.error("Failed to parse config content", e)
        setKvList([])
      }
    } else {
        setKvList([])
    }
  }, [activeConfig])

  // 统一更新函数
  const updateMutation = useMutation({
    mutationFn: (newContent: Record<string, any>) => {
      if (!activeConfig) throw new Error("No active config")
      return updateConfig(activeConfig.id, {
        content: JSON.stringify(newContent, null, 2),
        version: activeConfig.version,
        updated_by: 'admin' // 简化处理，实际应从上下文获取用户
      })
    },
    onSuccess: () => {
      listQ.refetch()
    },
    onError: (err) => {
      alert('更新失败: ' + err)
    }
  })

  // 创建新配置（当该环境无配置时）
  const createMutation = useMutation({
    mutationFn: () => createConfig({
      service_code: serviceCode,
      env: env,
      format: 'json',
      content: '{}'
    }),
    onSuccess: () => {
      listQ.refetch()
    }
  })

  // 添加/编辑弹窗状态
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState<{key: string, value: string, isNew: boolean}>({ key: '', value: '', isNew: true })

  // 处理删除
  const handleDelete = (keyToDelete: string) => {
    if (!confirm(`确定要删除配置 "${keyToDelete}" 吗？`)) return
    
    const currentObj: Record<string, any> = {}
    kvList.forEach(item => currentObj[item.key] = item.value)
    delete currentObj[keyToDelete]
    
    updateMutation.mutate(currentObj)
  }

  // 处理保存（新增或修改）
  const handleSave = () => {
    const currentObj: Record<string, any> = {}
    kvList.forEach(item => currentObj[item.key] = item.value)
    
    // 尝试解析 Value 为 JSON 或 Number/Boolean
    let finalValue: any = editForm.value
    // 简单的类型推断
    if (editForm.value === 'true') finalValue = true
    else if (editForm.value === 'false') finalValue = false
    else if (!isNaN(Number(editForm.value)) && editForm.value.trim() !== '') finalValue = Number(editForm.value)
    else {
        try {
             // 尝试解析 JSON
             const parsed = JSON.parse(editForm.value)
             if (typeof parsed === 'object') finalValue = parsed
        } catch {
            // keep string
        }
    }
    
    currentObj[editForm.key] = finalValue
    updateMutation.mutate(currentObj)
    setShowEditModal(false)
  }

  // 打开新增弹窗
  const openAdd = () => {
    setEditForm({ key: '', value: '', isNew: true })
    setShowEditModal(true)
  }

  // 打开编辑弹窗
  const openEdit = (item: KvItem) => {
    let valStr = String(item.value)
    if (typeof item.value === 'object') valStr = JSON.stringify(item.value, null, 2)
    
    setEditForm({ key: item.key, value: valStr, isNew: false })
    setShowEditModal(true)
  }

  return (
    <div className="grid gap-6">
      <div className="bg-white p-4 rounded-md shadow">
        <div className="flex justify-between items-center mb-3">
          <div className="text-lg font-medium">配置列表</div>
          
          {/* 只有在选择了环境且已有配置时才显示添加按钮 */}
          {env && activeConfig && (
            <button 
                onClick={openAdd}
                className="flex items-center px-3 py-1.5 rounded-lg text-sm transition-colors bg-blue-600 text-white hover:bg-blue-700"
            >
                <Plus className="w-4 h-4 mr-1" />
                新建配置
            </button>
          )}
        </div>

        {/* 弹窗 */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 relative">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-900">{editForm.isNew ? '新建配置项' : '编辑配置项'}</h3>
                <button onClick={() => setShowEditModal(false)} className="text-gray-500 hover:text-gray-700"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">配置名称 (Key)</label>
                    <input 
                        className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-gray-100"
                        value={editForm.key}
                        onChange={e => setEditForm({...editForm, key: e.target.value})}
                        disabled={!editForm.isNew} // 编辑模式下 Key 不可改
                        placeholder="e.g. database_url"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">配置值 (Value)</label>
                    <textarea 
                        className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono text-sm"
                        rows={5}
                        value={editForm.value}
                        onChange={e => setEditForm({...editForm, value: e.target.value})}
                        placeholder="输入值..."
                    />
                    <p className="text-xs text-gray-500 mt-1">支持字符串、数字、布尔值及 JSON 对象。</p>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                    <button onClick={() => setShowEditModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">取消</button>
                    <button 
                        onClick={handleSave} 
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        disabled={!editForm.key}
                    >
                        保存
                    </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2 items-center mb-4 justify-end">
          <button className="bg-gray-800 text-white px-3 py-2 rounded-lg text-sm hover:bg-gray-900 shadow-sm" onClick={()=>listQ.refetch()}>刷新列表</button>
        </div>

        <div className="overflow-hidden border rounded-lg min-h-[200px]">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr className="text-left text-gray-600">
                <th className="p-3 font-medium w-1/3">配置名称</th>
                <th className="p-3 font-medium w-1/3">配置值</th>
                <th className="p-3 font-medium w-1/3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {env && activeConfig && kvList.map((item) => (
                <tr key={item.key} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="p-3 font-mono text-gray-700 select-all">{item.key}</td>
                  <td className="p-3 font-mono text-gray-600 break-all">
                    {typeof item.value === 'object' 
                        ? JSON.stringify(item.value) 
                        : String(item.value)
                    }
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-2">
                        <button 
                            className="text-blue-600 hover:text-blue-800 p-1.5 hover:bg-blue-50 rounded transition-colors"
                            onClick={() => openEdit(item)}
                            title="编辑"
                        >
                            <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                            className="text-red-600 hover:text-red-800 p-1.5 hover:bg-red-50 rounded transition-colors"
                            onClick={() => handleDelete(item.key)}
                            title="删除"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                  </td>
                </tr>
              ))}
              
              {/* 空状态处理 */}
              {!env && (
                <tr>
                    <td colSpan={3} className="p-12 text-center text-gray-400">
                        请先选择一个环境以管理配置
                    </td>
                </tr>
              )}
              
              {env && !activeConfig && !listQ.isLoading && (
                 <tr>
                    <td colSpan={3} className="p-12 text-center">
                        <p className="text-gray-500 mb-4">该环境暂无配置</p>
                        <button 
                            onClick={() => createMutation.mutate()}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                        >
                            初始化配置
                        </button>
                    </td>
                </tr>
              )}

              {env && activeConfig && kvList.length === 0 && (
                <tr>
                    <td colSpan={3} className="p-12 text-center text-gray-400">
                        暂无配置项，点击右上角“新建配置”添加
                    </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
