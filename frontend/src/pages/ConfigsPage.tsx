import { useMutation, useQuery } from '@tanstack/react-query'
import { createConfig, listConfigs, updateConfig, listVersions, rollbackConfig, diffConfig } from '../api'
import { useEffect, useState } from 'react'
import { useSearchParams, useParams } from 'react-router-dom'
import ConfigKvTable, { KvRow } from '../components/ConfigKvTable'

import { Trash2, Plus, RotateCcw, GitCompare, X, Check } from 'lucide-react'

// 语义化版本号补丁位递增：x.y.z -> x.y.(z+1)
// 若无法解析，返回 '0.0.1'
const incPatch = (v: string | number | undefined): string => {
  const s = String(v ?? '')
  // 兼容可能包含预发布标签的情况，如 1.2.3-beta => 只提升前面的 3
  const m = s.match(/^\s*(\d+)\.(\d+)\.(\d+)/)
  if (m) {
    const major = Number(m[1])
    const minor = Number(m[2])
    const patch = Number(m[3])
    return `${major}.${minor}.${patch + 1}`
  }
  return '0.0.1'
}

// Standard Environments
const ENV_OPTIONS = [
  { value: 'dev', label: '开发环境 (dev)' },
  { value: 'test', label: '测试环境 (test)' },
  { value: 'stage', label: '预发布环境 (stage)' },
  { value: 'prod', label: '生产环境 (prod)' },
]

const kvToJson = (rows: KvRow[]) => {
  const obj: Record<string, string> = {}
  rows.forEach(r => {
    if (!r.key) return
    obj[r.key] = r.value
  })
  return JSON.stringify(obj, null, 2)
}

// Helper to convert JSON string to KV rows
const parseJsonToKv = (jsonStr: string): KvRow[] => {
  try {
    const obj = JSON.parse(jsonStr)
    if (typeof obj !== 'object' || obj === null) return [{key: '', value: ''}]
    return Object.entries(obj).map(([key, val]) => ({ key, value: String(val) }))
  } catch (e) {
    console.error("Failed to parse JSON", e)
    return [{key: '', value: ''}]
  }
}

export default function ConfigsPage() {
  const [searchParams] = useSearchParams()
  const { code } = useParams<{ code: string }>()
  const initialService = code || searchParams.get('service') || ''

  const [service, setService] = useState(initialService)
  const [env, setEnv] = useState('')
  const listQ = useQuery({ queryKey: ['cfgs', service, env], queryFn: () => listConfigs({ service, env }) })
  const [createForm, setCreateForm] = useState({ service_code: initialService, env: '', format: 'json', content: '', version: '0.0.1' })
  
  // KV Table state
  const [kvRows, setKvRows] = useState<KvRow[]>([{key: '', value: ''}])
  
  const handleCreate = () => {
    try {
      const content = kvToJson(kvRows)
      createM.mutate({ ...createForm, content })
    } catch (e) {
      alert('生成 JSON 失败，请检查输入')
    }
  }

  const createM = useMutation({ mutationFn: (data: typeof createForm) => createConfig(data), onSuccess: () => listQ.refetch() })
  
  const [sel, setSel] = useState<any>(null)
  
  // Edit KV Table state
  const [editKvRows, setEditKvRows] = useState<KvRow[]>([])
  
  const [editVersion, setEditVersion] = useState<string>('')
  const [nextVersion, setNextVersion] = useState<string>('')
  const [updatedBy, setUpdatedBy] = useState('')
  // 应用新版本号弹窗状态
  const [showBumpModal, setShowBumpModal] = useState(false)
  const [bumpVersion, setBumpVersion] = useState<string>('')
  
  const updateM = useMutation({ 
    mutationFn: () => {
        const content = kvToJson(editKvRows)
        return updateConfig(sel.id, { content, base_version: editVersion, version: nextVersion, updated_by: updatedBy })
    }, 
    onSuccess: () => listQ.refetch() 
  })
  
  const versionsQ = useQuery({ queryKey: ['versions', sel?.id], queryFn: () => sel ? listVersions(sel.id) : Promise.resolve([]) })
  const [rollbackVer, setRollbackVer] = useState<string>('')
  const [rollbackNewVer, setRollbackNewVer] = useState<string>('')
  const [rollbackSummary, setRollbackSummary] = useState<string>('')
  const rollbackM = useMutation({ mutationFn: () => rollbackConfig(sel.id, rollbackVer, rollbackNewVer, rollbackSummary), onSuccess: () => { listQ.refetch(); versionsQ.refetch() } })
  const [fromV, setFromV] = useState<string>('')
  const [toV, setToV] = useState<string>('')
  const [diffText, setDiffText] = useState('')
  
  // Enhanced Diff & Rollback State
  const [selectedForDiff, setSelectedForDiff] = useState<string[]>([])
  const [showRollbackModal, setShowRollbackModal] = useState(false)
  const [showDiffModal, setShowDiffModal] = useState(false)

  const handleDiffCheck = (v: string) => {
    setSelectedForDiff(prev => {
      if (prev.includes(v)) return prev.filter(x => x !== v)
      if (prev.length >= 2) return [prev[1], v] // Keep last 2
      return [...prev, v]
    })
  }

  const openDiffModal = (v1: string, v2: string) => {
    setFromV(v1)
    setToV(v2)
    // Trigger diff fetch
    diffConfig(sel.id, v1, v2).then(d => {
        setDiffText(d.diff)
        setShowDiffModal(true)
    })
  }

  const openRollbackModal = (v: string) => {
    setRollbackVer(v)
    setRollbackNewVer(incPatch(editVersion)) // Based on current latest
    setRollbackSummary(`Rollback to ${v}`)
    setShowRollbackModal(true)
  }
  
  useEffect(()=>{
    if (sel) { 
        setEditKvRows(parseJsonToKv(sel.content))
        setEditVersion(String(sel.version))
        // 选择配置后默认 nextVersion = incPatch(current)
        setNextVersion(incPatch(sel.version)) 
    }
  },[sel])
  
  const diffRun = async ()=>{ if (!sel) return; const d = await diffConfig(sel.id, fromV, toV); setDiffText(d.diff) }
  
  return (
    <div className="grid gap-6">
      <div className="bg-white p-4 rounded-md shadow">
        <div className="text-lg font-medium mb-3">查询</div>
        <div className="flex gap-2 items-center">
          <input className="border px-2 py-1 rounded" placeholder="service" value={service} onChange={e=>setService(e.target.value)} />
          
          {/* Changed Env Input to Select */}
          <div className="relative">
                <select 
                    className="appearance-none border px-3 py-1 pr-8 rounded bg-white" 
                    value={env} 
                    onChange={e=>setEnv(e.target.value)}
                >
                    <option value="">所有环境</option>
                    {ENV_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                    <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
          </div>

          <button className="bg-gray-700 text-white px-3 py-1 rounded" onClick={()=>listQ.refetch()}>刷新</button>
        </div>
        <div className="mt-3 overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="p-2">ID</th>
                <th className="p-2">服务</th>
                <th className="p-2">环境</th>
                <th className="p-2">格式</th>
                <th className="p-2">版本</th>
                <th className="p-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {Array.isArray(listQ.data) && listQ.data.map((c:any)=> (
                <tr key={c.id} className="border-t">
                  <td className="p-2">{c.id}</td>
                  <td className="p-2">{c.service_id}</td>
                  <td className="p-2">{c.env}</td>
                  <td className="p-2">{c.format}</td>
                  <td className="p-2">{c.version}</td>
                  <td className="p-2"><button className="bg-blue-600 text-white px-2 py-1 rounded" onClick={()=>setSel(c)}>编辑</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="bg-white p-4 rounded-md shadow">
        <div className="text-lg font-medium mb-3">创建配置</div>
        <div className="grid grid-cols-5 gap-2 mb-3">
          <input className="border px-2 py-1 rounded" placeholder="service_code" value={createForm.service_code} onChange={e=>setCreateForm({...createForm, service_code:e.target.value})} />
          
          {/* Changed Env Input to Select */}
          <select 
            className="border px-2 py-1 rounded bg-white" 
            value={createForm.env} 
            onChange={e=>setCreateForm({...createForm, env:e.target.value})} 
          >
            <option value="">请选择环境</option>
            {ENV_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <select className="border px-2 py-1 rounded" value={createForm.format} disabled>
            <option value="json">json (表格生成)</option>
          </select>
          
          <input className="border px-2 py-1 rounded" placeholder="Version (e.g. 0.0.1)" value={createForm.version} onChange={e=>setCreateForm({...createForm, version:e.target.value})} />

          <button className="bg-green-600 text-white px-3 py-1 rounded" onClick={handleCreate} disabled={!createForm.service_code||!createForm.env}>创建</button>
        </div>
        
        {/* KV Table */}
        <ConfigKvTable rows={kvRows} setRows={setKvRows} />
      </div>
      {sel && (
        <div className="bg-white p-4 rounded-md shadow">
          <div className="text-lg font-medium mb-3">编辑配置</div>
          <div className="grid grid-cols-4 gap-2 items-center">
            <div className="text-sm">ID {sel.id}</div>
            <div className="flex items-center gap-2 col-span-2">
                <span className="text-sm whitespace-nowrap">Current:</span>
                <input className="border px-2 py-1 rounded w-20 bg-gray-100" value={editVersion} disabled />
                <span className="text-sm whitespace-nowrap">New:</span>
                <input className="border px-2 py-1 rounded w-full" placeholder="New Version" value={nextVersion} onChange={e=>setNextVersion(e.target.value)} />
            </div>
            <div className="flex gap-2">
                <input className="border px-2 py-1 rounded w-full" placeholder="updated_by" value={updatedBy} onChange={e=>setUpdatedBy(e.target.value)} />
                <button className="bg-blue-600 text-white px-3 py-1 rounded whitespace-nowrap" onClick={()=>updateM.mutate()}>保存</button>
                {/* 应用新版本号：弹窗输入并复制当前内容到新版本 */}
                <button 
                  className="border border-gray-300 bg-white text-gray-700 px-3 py-1 rounded whitespace-nowrap hover:bg-gray-50"
                  onClick={()=>{ setBumpVersion(incPatch(editVersion)); setShowBumpModal(true) }}
                >
                  应用新版本号
                </button>
            </div>
          </div>
          
          <div className="mt-3">
             <div className="text-sm font-medium mb-2 text-gray-700">配置内容</div>
             <ConfigKvTable rows={editKvRows} setRows={setEditKvRows} />
          </div>

          <div className="mt-3">
            <div className="flex justify-between items-center mb-2">
                <div className="text-sm font-medium text-gray-700">版本历史</div>
                <div className="flex gap-2">
                    {selectedForDiff.length === 2 && (
                        <button 
                            className="bg-indigo-600 text-white px-3 py-1 rounded flex items-center gap-1 text-xs"
                            onClick={() => openDiffModal(selectedForDiff[0], selectedForDiff[1])}
                        >
                            <GitCompare size={14} /> 对比选定 ({selectedForDiff[0]} vs {selectedForDiff[1]})
                        </button>
                    )}
                    <button className="bg-gray-700 text-white px-3 py-1 rounded text-xs" onClick={()=>versionsQ.refetch()}>刷新</button>
                </div>
            </div>
            <table className="w-full text-sm mt-2">
              <thead>
                <tr className="text-left bg-gray-50">
                  <th className="p-2 w-8"></th>
                  <th className="p-2">版本</th>
                  <th className="p-2">摘要</th>
                  <th className="p-2">创建者</th>
                  <th className="p-2">时间</th>
                  <th className="p-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(versionsQ.data) && versionsQ.data.map((v:any)=> (
                  <tr key={v.version} className="border-t hover:bg-gray-50">
                    <td className="p-2">
                        <input 
                            type="checkbox" 
                            checked={selectedForDiff.includes(v.version)} 
                            onChange={()=>handleDiffCheck(v.version)}
                        />
                    </td>
                    <td className="p-2 font-medium">{v.version}</td>
                    <td className="p-2 text-gray-500">{v.summary||'-'}</td>
                    <td className="p-2 text-gray-500">{v.created_by||'-'}</td>
                    <td className="p-2 text-gray-500">{v.created_at}</td>
                    <td className="p-2 text-right flex justify-end gap-2">
                        <button 
                            className="text-blue-600 hover:text-blue-800" 
                            title="Diff with current"
                            onClick={()=>openDiffModal(v.version, editVersion)}
                        >
                            <GitCompare size={16} />
                        </button>
                        <button 
                            className="text-red-600 hover:text-red-800" 
                            title="Rollback to this version"
                            onClick={()=>openRollbackModal(v.version)}
                        >
                            <RotateCcw size={16} />
                        </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Rollback Modal */}
          {showRollbackModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 relative">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-gray-900">回滚配置</h3>
                        <button onClick={()=>setShowRollbackModal(false)}><X size={20} className="text-gray-500 hover:text-gray-700" /></button>
                    </div>
                    <div className="space-y-4">
                        <div className="p-3 bg-yellow-50 text-yellow-800 rounded text-sm">
                            确定要将配置回滚到版本 <b>{rollbackVer}</b> 吗？
                            这将会创建一个新的版本。
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">新版本号</label>
                            <input 
                                className="w-full border px-3 py-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" 
                                value={rollbackNewVer} 
                                onChange={e=>setRollbackNewVer(e.target.value)} 
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">备注摘要</label>
                            <input 
                                className="w-full border px-3 py-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" 
                                value={rollbackSummary} 
                                onChange={e=>setRollbackSummary(e.target.value)} 
                                placeholder="例如：回滚原因..."
                            />
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <button className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded" onClick={()=>setShowRollbackModal(false)}>取消</button>
                            <button 
                                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700" 
                                onClick={()=>{ rollbackM.mutate(); setShowRollbackModal(false) }}
                            >
                                确认回滚
                            </button>
                        </div>
                    </div>
                </div>
            </div>
          )}

          {/* Diff Modal */}
          {showDiffModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl p-6 relative h-[80vh] flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-gray-900">版本对比: {fromV} vs {toV}</h3>
                        <button onClick={()=>setShowDiffModal(false)}><X size={20} className="text-gray-500 hover:text-gray-700" /></button>
                    </div>
                    <div className="flex-1 overflow-auto bg-gray-900 text-gray-100 p-4 rounded font-mono text-sm">
                        <pre>{diffText || 'No differences found or loading...'}</pre>
                    </div>
                    <div className="mt-4 flex justify-end">
                        <button className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300" onClick={()=>setShowDiffModal(false)}>关闭</button>
                    </div>
                </div>
            </div>
          )}
          {/* 应用新版本号弹窗 */}
          {showBumpModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 relative">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-gray-900">应用新版本号</h3>
                  <button onClick={()=>setShowBumpModal(false)} className="text-gray-500 hover:text-gray-700">×</button>
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <label className="text-sm text-gray-700">当前版本</label>
                    <input className="col-span-2 border px-3 py-2 rounded bg-gray-100" value={editVersion} disabled />
                  </div>
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <label className="text-sm text-gray-700">新版本</label>
                    <input 
                      className="col-span-2 border px-3 py-2 rounded"
                      value={bumpVersion}
                      onChange={e=>setBumpVersion(e.target.value)}
                      placeholder={`建议: ${incPatch(editVersion)}`}
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button onClick={()=>setShowBumpModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded">取消</button>
                    <button 
                      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                      onClick={async ()=>{
                        try {
                          const content = kvToJson(editKvRows)
                          await updateConfig(sel.id, { content, base_version: editVersion, version: bumpVersion, updated_by: updatedBy })
                          setShowBumpModal(false)
                          setNextVersion(bumpVersion)
                          listQ.refetch();
                          versionsQ.refetch();
                        } catch (e:any) {
                          alert('应用新版本失败: ' + (e?.message||e))
                        }
                      }}
                    >
                      应用
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// 版本号应用弹窗状态与实现（复制旧配置到新版本）
// 放在组件末尾声明状态和 JSX 以保持代码集中度
// 由于函数组件，每次渲染都会读取最新 sel/editKvRows
// state hooks 需在组件顶层，这里前移声明
