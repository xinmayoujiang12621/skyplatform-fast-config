import { useMutation, useQuery } from '@tanstack/react-query'
import { addAllowIp, deleteAllowIp, listAllowIps } from '../api'
import { useState } from 'react'
import { Plus, Trash2, Shield, AlertCircle } from 'lucide-react'
import { useEnv } from '../context/EnvContext'

export default function IpAllowList({ serviceCode }: { serviceCode: string }) {
  const { currentEnv } = useEnv()
  
  // Query
  const { data: rules, refetch, isLoading, error } = useQuery({
    queryKey: ['allow-ips', serviceCode, currentEnv],
    queryFn: () => listAllowIps(serviceCode, currentEnv)
  })

  // Add Mutation
  const [newCidr, setNewCidr] = useState('')
  const [newNote, setNewNote] = useState('')
  const [addError, setAddError] = useState<string | null>(null)

  const addMutation = useMutation({
    mutationFn: () => addAllowIp(serviceCode, {
      cidr: newCidr,
      env: currentEnv,
      note: newNote || undefined
    }),
    onSuccess: () => {
      setNewCidr('')
      setNewNote('')
      setAddError(null)
      refetch()
    },
    onError: (err: any) => {
      setAddError(err.message || 'Failed to add rule')
    }
  })

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteAllowIp(serviceCode, id),
    onSuccess: () => {
      refetch()
    },
    onError: (err: any) => {
      alert('Failed to delete: ' + err.message)
    }
  })

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCidr.trim()) return
    addMutation.mutate()
  }

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to remove this IP rule?')) {
      deleteMutation.mutate(id)
    }
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                <Shield className="w-5 h-5" />
            </div>
            <div>
                <h3 className="text-lg font-semibold text-gray-900">IP 白名单</h3>
                <p className="text-sm text-gray-500">控制允许访问该服务配置的来源 IP</p>
            </div>
        </div>
      </div>

      {/* Add Form */}
      <form onSubmit={handleAdd} className="bg-gray-50 p-4 rounded-lg mb-6 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-5">
            <label className="block text-xs font-medium text-gray-700 mb-1">IP / CIDR</label>
            <input 
              type="text" 
              placeholder="e.g. 192.168.1.1 or 10.0.0.0/24"
              className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm px-3 py-2 border"
              value={newCidr}
              onChange={e => setNewCidr(e.target.value)}
            />
          </div>
          <div className="md:col-span-5">
            <label className="block text-xs font-medium text-gray-700 mb-1">备注 (可选)</label>
            <input 
              type="text" 
              placeholder="e.g. Office VPN"
              className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm px-3 py-2 border"
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <button 
              type="submit"
              disabled={addMutation.isPending || !newCidr}
              className="w-full flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {addMutation.isPending ? '添加中...' : <><Plus className="w-4 h-4 mr-1" /> 添加</>}
            </button>
          </div>
        </div>
        {addError && (
            <div className="mt-2 text-sm text-red-600 flex items-center">
                <AlertCircle className="w-4 h-4 mr-1" />
                {addError}
            </div>
        )}
      </form>

      {/* List */}
      <div className="overflow-hidden shadow ring-1 ring-black/5 md:rounded-lg">
        <table className="min-w-full divide-y divide-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">CIDR / IP</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">环境</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">备注</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">添加时间</th>
              <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                <span className="sr-only">Delete</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {isLoading && (
                <tr>
                    <td colSpan={5} className="py-4 text-center text-sm text-gray-500">加载中...</td>
                </tr>
            )}
            {!isLoading && rules?.length === 0 && (
                <tr>
                    <td colSpan={5} className="py-8 text-center text-sm text-gray-500">
                        暂无白名单规则，默认禁止所有访问。请添加 IP 规则以允许访问。
                    </td>
                </tr>
            )}
            {rules?.map((rule) => (
              <tr key={rule.id}>
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 font-mono">
                  {rule.cidr}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  {rule.env ? (
                    <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                      {rule.env}
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">
                      全局 (All)
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  {rule.note || '-'}
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                  {new Date(rule.created_at).toLocaleString()}
                </td>
                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  <button
                    onClick={() => handleDelete(rule.id)}
                    className="text-red-600 hover:text-red-900 transition-colors p-1 rounded-full hover:bg-red-50"
                    title="删除规则"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
