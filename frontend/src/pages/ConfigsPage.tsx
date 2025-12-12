import { useMutation, useQuery } from '@tanstack/react-query'
import { createConfig, listConfigs, updateConfig, listVersions, rollbackConfig, diffConfig } from '../api'
import { useEffect, useState } from 'react'
import { useSearchParams, useParams } from 'react-router-dom'
import ConfigKvTable, { KvRow } from '../components/ConfigKvTable'

import { Trash2, Plus } from 'lucide-react'

// Standard Environments
const ENV_OPTIONS = [
  { value: 'dev', label: '开发环境 (dev)' },
  { value: 'test', label: '测试环境 (test)' },
  { value: 'stage', label: '预发布环境 (stage)' },
  { value: 'prod', label: '生产环境 (prod)' },
]

// Helper to convert KV rows to JSON string
const kvToJson = (rows: KvRow[]) => {
  const obj: Record<string, any> = {}
  rows.forEach(r => {
    if (!r.key) return
    if (r.type === 'number') {
      obj[r.key] = Number(r.value)
    } else if (r.type === 'boolean') {
      obj[r.key] = r.value === 'true'
    } else if (r.type === 'json') {
      try {
        obj[r.key] = JSON.parse(r.value)
      } catch {
        obj[r.key] = r.value
      }
    } else {
      obj[r.key] = r.value
    }
  })
  return JSON.stringify(obj, null, 2)
}

// Helper to convert JSON string to KV rows
const parseJsonToKv = (jsonStr: string): KvRow[] => {
  try {
    const obj = JSON.parse(jsonStr)
    if (typeof obj !== 'object' || obj === null) return [{key: '', value: '', type: 'string'}]
    
    return Object.entries(obj).map(([key, val]) => {
      let type = 'string'
      let value = String(val)
      
      if (typeof val === 'number') type = 'number'
      else if (typeof val === 'boolean') type = 'boolean'
      else if (typeof val === 'object') {
        type = 'json'
        value = JSON.stringify(val)
      }
      
      return { key, value, type }
    })
  } catch (e) {
    console.error("Failed to parse JSON", e)
    return [{key: '', value: '', type: 'string'}]
  }
}

export default function ConfigsPage() {
  const [searchParams] = useSearchParams()
  const { code } = useParams<{ code: string }>()
  const initialService = code || searchParams.get('service') || ''

  const [service, setService] = useState(initialService)
  const [env, setEnv] = useState('')
  const listQ = useQuery({ queryKey: ['cfgs', service, env], queryFn: () => listConfigs({ service, env }) })
  const [createForm, setCreateForm] = useState({ service_code: initialService, env: '', format: 'json', content: '' })
  
  // KV Table state
  const [kvRows, setKvRows] = useState<KvRow[]>([{key: '', value: '', type: 'string'}])
  
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
  
  const [editVersion, setEditVersion] = useState<number>(0)
  const [updatedBy, setUpdatedBy] = useState('')
  
  const updateM = useMutation({ 
    mutationFn: () => {
        const content = kvToJson(editKvRows)
        return updateConfig(sel.id, { content, version: editVersion, updated_by: updatedBy })
    }, 
    onSuccess: () => listQ.refetch() 
  })
  
  const versionsQ = useQuery({ queryKey: ['versions', sel?.id], queryFn: () => sel ? listVersions(sel.id) : Promise.resolve([]) })
  const [rollbackVer, setRollbackVer] = useState<number>(0)
  const rollbackM = useMutation({ mutationFn: () => rollbackConfig(sel.id, rollbackVer), onSuccess: () => { listQ.refetch(); versionsQ.refetch() } })
  const [fromV, setFromV] = useState<number>(0)
  const [toV, setToV] = useState<number>(0)
  const [diffText, setDiffText] = useState('')
  
  useEffect(()=>{
    if (sel) { 
        setEditKvRows(parseJsonToKv(sel.content))
        setEditVersion(sel.version) 
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
        <div className="grid grid-cols-4 gap-2 mb-3">
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
            <div className="text-sm">版本 {sel.version}</div>
            <input className="border px-2 py-1 rounded" placeholder="updated_by" value={updatedBy} onChange={e=>setUpdatedBy(e.target.value)} />
            <button className="bg-blue-600 text-white px-3 py-1 rounded" onClick={()=>updateM.mutate()}>保存</button>
          </div>
          
          <div className="mt-3">
             <div className="text-sm font-medium mb-2 text-gray-700">配置内容</div>
             <ConfigKvTable rows={editKvRows} setRows={setEditKvRows} />
          </div>

          <div className="mt-3">
            <div className="text-sm font-medium mb-2">版本历史</div>
            <button className="bg-gray-700 text-white px-3 py-1 rounded" onClick={()=>versionsQ.refetch()}>刷新</button>
            <table className="w-full text-sm mt-2">
              <thead>
                <tr className="text-left">
                  <th className="p-2">版本</th>
                  <th className="p-2">摘要</th>
                  <th className="p-2">创建者</th>
                  <th className="p-2">时间</th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(versionsQ.data) && versionsQ.data.map((v:any)=> (
                  <tr key={v.version} className="border-t">
                    <td className="p-2">{v.version}</td>
                    <td className="p-2">{v.summary||'-'}</td>
                    <td className="p-2">{v.created_by||'-'}</td>
                    <td className="p-2">{v.created_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2 items-center">
            <input className="border px-2 py-1 rounded" type="number" placeholder="回滚到版本" value={rollbackVer} onChange={e=>setRollbackVer(Number(e.target.value))} />
            <button className="bg-red-600 text-white px-3 py-1 rounded" onClick={()=>rollbackM.mutate()} disabled={!rollbackVer}>回滚</button>
            <input className="border px-2 py-1 rounded" type="number" placeholder="from" value={fromV} onChange={e=>setFromV(Number(e.target.value))} />
            <input className="border px-2 py-1 rounded" type="number" placeholder="to" value={toV} onChange={e=>setToV(Number(e.target.value))} />
            <button className="bg-gray-700 text-white px-3 py-1 rounded" onClick={diffRun} disabled={!fromV||!toV}>对比差异</button>
          </div>
          <pre className="mt-3 bg-gray-100 p-3 rounded overflow-auto text-xs">{diffText||''}</pre>
        </div>
      )}
    </div>
  )
}
