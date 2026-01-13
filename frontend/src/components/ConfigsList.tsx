import { useMutation, useQuery } from '@tanstack/react-query'
import { createConfig, listConfigs, updateConfig, importConfigText } from '../api'
import { useEffect, useState, useMemo } from 'react'
import { Plus, X, Trash2, Edit2, Save, Download, Upload, RefreshCw, Search } from 'lucide-react'

// Standard Environments

// 语义化版本号补丁位递增：x.y.z -> x.y.(z+1)，无法解析时返回 '0.0.1'
const incPatch = (v: string | number | undefined): string => {
  const s = String(v ?? '')
  const m = s.match(/^\s*(\d+)\.(\d+)\.(\d+)/)
  if (m) {
    const major = Number(m[1])
    const minor = Number(m[2])
    const patch = Number(m[3])
    return `${major}.${minor}.${patch + 1}`
  }
  return '0.0.1'
}

interface KvItem {
  key: string
  value: string
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
  const [searchQuery, setSearchQuery] = useState('')

  const filteredKvList = useMemo(() => {
    if (!searchQuery) return kvList
    const q = searchQuery.toLowerCase()
    return kvList.filter(item => item.key.toLowerCase().includes(q))
  }, [kvList, searchQuery])

  useEffect(() => {
    if (activeConfig) {
      try {
        const obj = JSON.parse(activeConfig.content)
        const list = Object.entries(obj).map(([key, value]) => ({ key, value: String(value) }))
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
    mutationFn: ({ content, version }: { content: Record<string, string>, version: string }) => {
      if (!activeConfig) throw new Error("No active config")
      return updateConfig(activeConfig.id, {
        content: JSON.stringify(content, null, 2),
        base_version: String(activeConfig.version),
        version: version,
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
    mutationFn: ({ content, version }: { content: string, version: string }) => createConfig({
      service_code: serviceCode,
      env: env,
      format: 'json',
      content: content,
      version: version
    }),
    onSuccess: () => {
      listQ.refetch()
    },
    onError: (err) => {
      alert('创建失败: ' + err)
    }
  })

  // 添加/编辑弹窗状态
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState<{key: string, value: string, isNew: boolean, version: string}>({ key: '', value: '', isNew: true, version: '' })
  const [showImportModal, setShowImportModal] = useState(false)
  const [importText, setImportText] = useState('')
  const [importVersion, setImportVersion] = useState('')
  // 应用新版本号弹窗
  const [showBumpModal, setShowBumpModal] = useState(false)
  const [bumpVersion, setBumpVersion] = useState('')

  // 导出为 .txt (KEY=VALUE 每行)
  const handleExportTxt = () => {
    if (!activeConfig) {
      alert('当前环境没有配置可导出')
      return
    }
    const lines = kvList.map(({ key, value }) => {
      return `${key}=${String(value)}`
    })
    const content = lines.join('\n')
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const now = new Date()
    const pad = (n: number) => `${n}`.padStart(2, '0')
    const filename = `${serviceCode}-${env}-config-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.txt`
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  // 处理删除
  const handleDelete = (keyToDelete: string) => {
    if (!confirm(`确定要删除配置 "${keyToDelete}" 吗？`)) return
    
    // Auto bump version
    const ver = activeConfig ? incPatch(String(activeConfig.version)) : '0.0.1'

    const currentObj: Record<string, string> = {}
    kvList.forEach(item => currentObj[item.key] = item.value)
    delete currentObj[keyToDelete]
    
    updateMutation.mutate({ content: currentObj, version: ver })
  }

  // 处理保存（新增或修改）
  const handleSave = () => {
    const finalValue = editForm.value
    
    // Auto calculate version
    const nextVer = activeConfig ? incPatch(String(activeConfig.version)) : '0.0.1'

    if (!activeConfig) {
        // 如果没有配置，则创建新配置
        const initialContent = JSON.stringify({ [editForm.key]: finalValue }, null, 2)
        createMutation.mutate({ content: initialContent, version: nextVer })
    } else {
        // 更新现有配置
        const currentObj: Record<string, string> = {}
        kvList.forEach(item => currentObj[item.key] = item.value)
        currentObj[editForm.key] = finalValue
        updateMutation.mutate({ content: currentObj, version: nextVer })
    }
    setShowEditModal(false)
  }

  // 打开新增弹窗
  const openAdd = () => {
    // If config exists, it's an update, so version should be new (empty to prompt user). If not, it's create (default 0.0.1)
    setEditForm({ key: '', value: '', isNew: true, version: activeConfig ? '' : '0.0.1' })
    setShowEditModal(true)
  }

  // 打开编辑弹窗
  const openEdit = (item: KvItem) => {
    const valStr = String(item.value)
    setEditForm({ key: item.key, value: valStr, isNew: false, version: '' })
    setShowEditModal(true)
  }

  return (
    <div className="grid gap-6">
      <div className="bg-white p-4 rounded-md shadow">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-3">
            <div className="text-lg font-medium">配置列表</div>
            {activeConfig && (
              <span className="bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded border border-blue-200">
                v{activeConfig.version}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <div className="relative mr-2">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text"
                placeholder="搜索配置名称"
                className="pl-9 pr-4 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64 transition-all"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            {env && (
                <button 
                    onClick={openAdd}
                    className="flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                >
                    <Plus className="w-4 h-4 mr-1.5" />
                    添加
                </button>
            )}
            {env && (
              <button 
                onClick={() => setShowImportModal(true)}
                className="flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 shadow-sm"
              >
                <Upload className="w-4 h-4 mr-1.5" />
                导入覆盖
              </button>
            )}
            {env && (
              <button 
                onClick={handleExportTxt}
                className="flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 shadow-sm"
              >
                <Download className="w-4 h-4 mr-1.5" />
                导出TXT
              </button>
            )}
            {env && activeConfig && (
              <button
                onClick={()=>{ setBumpVersion(incPatch(String(activeConfig.version))); setShowBumpModal(true) }}
                className="flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 shadow-sm"
              >
                应用新版本号
              </button>
            )}
            <button 
                className="flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 shadow-sm" 
                onClick={()=>listQ.refetch()}
            >
                <RefreshCw className={`w-4 h-4 mr-1.5 ${listQ.isFetching ? 'animate-spin' : ''}`} />
                刷新列表
            </button>
          </div>
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
                    <p className="text-xs text-gray-500 mt-1">仅支持字符串值。</p>
                </div>
                {/* Version input removed - auto calculated */}
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
        {showImportModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-xl p-6 relative">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-900">导入覆盖（.env 格式）</h3>
                <button onClick={() => setShowImportModal(false)} className="text-gray-500 hover:text-gray-700"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-3">
                <p className="text-sm text-gray-500">支持 .env 文件格式：每行一个 <code className="font-mono">KEY=VALUE</code>，以 <code className="font-mono">#</code> 开头的行为注释。</p>
                <textarea 
                  className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono text-sm min-h-[220px]"
                  placeholder="APP_PORT=8000\nDB_HOST=127.0.0.1\n# comment line\nFEATURE_X=true"
                  value={importText}
                  onChange={e => setImportText(e.target.value)}
                />
                <div className="mt-2">
                     <div className="p-3 bg-gray-50 text-gray-600 rounded-lg text-sm border border-gray-200">
                        <span className="font-medium">提示：</span> 
                        导入后版本号将自动递增为 <span className="font-mono font-bold text-gray-800">v{activeConfig ? incPatch(String(activeConfig.version)) : '0.0.1'}</span>
                     </div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => setShowImportModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">取消</button>
                  <button 
                    onClick={async () => {
                      if (!importText.trim()) return
                      
                      // Auto calculate version for import
                      const nextVer = activeConfig ? incPatch(String(activeConfig.version)) : '0.0.1'

                      await importConfigText({ 
                        service_code: serviceCode, 
                        env, 
                        text: importText, 
                        overwrite: true, 
                        updated_by: 'admin', 
                        base_version: activeConfig ? String(activeConfig.version) : undefined,
                        new_version: nextVer 
                      })
                      setShowImportModal(false)
                      setImportText('')
                      setImportVersion('')
                      listQ.refetch()
                    }}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    导入并覆盖
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 应用新版本号弹窗：复制当前内容到新版本 */}
        {showBumpModal && activeConfig && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 relative">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-900">应用新版本号</h3>
                <button onClick={() => setShowBumpModal(false)} className="text-gray-500 hover:text-gray-700"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2 items-center">
                  <label className="text-sm text-gray-700">当前版本</label>
                  <input className="col-span-2 border border-gray-300 px-3 py-2 rounded-lg bg-gray-100" value={String(activeConfig.version)} disabled />
                </div>
                <div className="grid grid-cols-3 gap-2 items-center">
                  <label className="text-sm text-gray-700">新版本</label>
                  <input 
                    className="col-span-2 border border-gray-300 px-3 py-2 rounded-lg"
                    value={bumpVersion}
                    onChange={e=>setBumpVersion(e.target.value)}
                    placeholder={`建议: ${incPatch(String(activeConfig.version))}`}
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => setShowBumpModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">取消</button>
                  <button 
                    onClick={async () => {
                      try {
                        await updateConfig(activeConfig.id, {
                          content: String(activeConfig.content),
                          base_version: String(activeConfig.version),
                          version: bumpVersion,
                          updated_by: 'admin'
                        })
                        setShowBumpModal(false)
                        listQ.refetch()
                      } catch (e:any) {
                        alert('应用新版本失败: ' + (e?.message || e))
                      }
                    }}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                  >
                    应用
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

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
              {env && activeConfig && filteredKvList.map((item) => (
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
                 /* Empty state */
                 null
              )}

              {env && activeConfig && kvList.length > 0 && filteredKvList.length === 0 && (
                <tr>
                    <td colSpan={3} className="p-8 text-center text-gray-400">
                        未找到匹配 "{searchQuery}" 的配置项
                    </td>
                </tr>
              )}

              {env && activeConfig && kvList.length === 0 && (
                /* Empty list state */
                null
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
