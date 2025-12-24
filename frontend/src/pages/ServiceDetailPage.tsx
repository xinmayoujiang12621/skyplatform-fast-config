import { useMutation, useQuery } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { listCredentials, deleteService, generateToken as apiGenerateToken, listTokens, deleteToken } from '../api'
import { useState } from 'react'
import { ArrowLeft, Shield, Copy, Trash2, AlertTriangle, Code2, Loader2, Check, Settings, List, Lock, Link as LinkIcon } from 'lucide-react'
import ConfigsList from '../components/ConfigsList'
import IpAllowList from '../components/IpAllowList'
import { useEnv } from '../context/EnvContext'

export default function ServiceDetailPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { currentEnv } = useEnv() // Use global env

  const credsQ = useQuery({ 
    queryKey: ['creds', code], 
    queryFn: () => code ? listCredentials(code) : Promise.resolve([]),
    enabled: !!code 
  })
  
  const tokensQ = useQuery({
    queryKey: ['tokens', code],
    queryFn: () => code ? listTokens(code) : Promise.resolve([]),
    enabled: !!code
  })

  const deleteTokenM = useMutation({
    mutationFn: (id: number) => deleteToken(code!, id),
    onSuccess: () => tokensQ.refetch()
  })

  const [showDelete, setShowDelete] = useState(false)
  
  // View mode state: 'tokens' or 'configs' or 'ips'
  const [viewMode, setViewMode] = useState<'tokens' | 'configs' | 'ips'>('configs')
  
  const deleteM = useMutation({
    mutationFn: () => deleteService(code!),
    onSuccess: () => {
      setShowDelete(false)
      navigate('/')
    }
  })

  // Token 生成状态
  const [showTokenGen, setShowTokenGen] = useState(false)
  // const [currentEnv, setCurrentEnv] = useState('prod') // Removed local state
  const [generatedToken, setToken] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  const [copiedUrl, setCopiedUrl] = useState(false)
  const handleCopyQuickLink = () => {
    if (!code) return
    const base = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:8000'
    const url = `${base}/api/v1/pull/${code}/${currentEnv}`
    navigator.clipboard.writeText(url)
    setCopiedUrl(true)
    setTimeout(() => setCopiedUrl(false), 2000)
  }

  const handleGenerateToken = async () => {
    if (!code) return
    setIsGenerating(true)
    try {
      const res = await apiGenerateToken(code, currentEnv)
      setToken(res.token)
      setShowTokenGen(true)
      tokensQ.refetch()
    } catch (e) {
      alert('Token 生成失败，请稍后重试')
    } finally {
      setIsGenerating(false)
    }
  }

  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedToken(text)
    setTimeout(() => setCopiedToken(null), 2000)
  }

  if (!code) return <div>Invalid Service Code</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/')}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{code}</h1>
            <p className="text-sm text-gray-500">服务详情与凭证管理</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowDelete(true)}
            className="flex items-center px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            服务注销
          </button>
        </div>
      </div>

      <div className="grid gap-6">
        {/* 凭证列表 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-gray-900">访问凭证 (Access Credentials)</h3>
            </div>
            <div className="flex items-center gap-3">
              {/* Environment Selector moved to Top Header */}
              <button
                onClick={handleCopyQuickLink}
                className={`flex items-center px-3 py-1.5 text-sm rounded-lg transition-colors shadow-sm border ${
                  copiedUrl ? 'bg-green-100 border-green-200 text-green-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
                title="复制当前环境的拉取链接"
              >
                <LinkIcon className="w-3.5 h-3.5 mr-2" />
                {copiedUrl ? '已复制链接' : '复制拉取链接'}
              </button>
              <button 
                onClick={handleGenerateToken}
                disabled={isGenerating}
                className="flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
              >
                {isGenerating ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Code2 className="w-3.5 h-3.5 mr-2" />}
                生成 Token
              </button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 font-medium">
                <tr>
                  <th className="px-6 py-3">Access Key (AK)</th>
                  <th className="px-6 py-3">状态</th>
                  <th className="px-6 py-3">创建时间</th>
                  <th className="px-6 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {Array.isArray(credsQ.data) && credsQ.data.map((c:any) => (
                  <tr key={c.ak} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-gray-700">{c.ak}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        c.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {c.status === 'active' ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">{new Date(c.created_at).toLocaleString()}</td>
                    <td className="px-6 py-4 text-right">
                      {c.status === 'active' && (
                        <button className="text-red-600 hover:text-red-800 text-xs font-medium">禁用</button>
                      )}
                    </td>
                  </tr>
                ))}
                {credsQ.data?.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-400">
                      暂无有效凭证
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 快捷入口 / 视图切换 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div 
            onClick={() => setViewMode('configs')}
            className={`p-6 rounded-xl border cursor-pointer hover:shadow-md transition-all ${
              viewMode === 'configs' 
                ? 'bg-blue-50 border-blue-200 shadow-sm ring-1 ring-blue-200' 
                : 'bg-white border-gray-100'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Settings className={`w-5 h-5 ${viewMode === 'configs' ? 'text-blue-600' : 'text-gray-400'}`} />
              <h3 className={`text-lg font-semibold ${viewMode === 'configs' ? 'text-blue-900' : 'text-gray-900'}`}>管理配置</h3>
            </div>
            <p className={`text-sm ${viewMode === 'configs' ? 'text-blue-700' : 'text-gray-600'}`}>
              查看、编辑或发布 {code} 的配置项。
            </p>
          </div>
          
          <div 
             onClick={() => setViewMode('tokens')}
             className={`p-6 rounded-xl border cursor-pointer hover:shadow-md transition-all ${
              viewMode === 'tokens' 
                ? 'bg-red-50 border-red-200 shadow-sm ring-1 ring-red-200' 
                : 'bg-white border-gray-100'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <List className={`w-5 h-5 ${viewMode === 'tokens' ? 'text-red-600' : 'text-gray-400'}`} />
              <h3 className={`text-lg font-semibold ${viewMode === 'tokens' ? 'text-red-900' : 'text-gray-900'}`}>生效可用的 Token</h3>
            </div>
            <p className={`text-sm ${viewMode === 'tokens' ? 'text-red-700' : 'text-gray-600'}`}>
              管理用于拉取配置的访问令牌。
            </p>
          </div>

          <div 
             onClick={() => setViewMode('ips')}
             className={`p-6 rounded-xl border cursor-pointer hover:shadow-md transition-all ${
              viewMode === 'ips' 
                ? 'bg-green-50 border-green-200 shadow-sm ring-1 ring-green-200' 
                : 'bg-white border-gray-100'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Lock className={`w-5 h-5 ${viewMode === 'ips' ? 'text-green-600' : 'text-gray-400'}`} />
              <h3 className={`text-lg font-semibold ${viewMode === 'ips' ? 'text-green-900' : 'text-gray-900'}`}>IP 白名单</h3>
            </div>
            <p className={`text-sm ${viewMode === 'ips' ? 'text-green-700' : 'text-gray-600'}`}>
              管理允许访问服务的来源 IP 地址。
            </p>
          </div>
        </div>

        {/* 动态视图区域 */}
        {viewMode === 'tokens' && (
          <div className="bg-white rounded-xl shadow-sm border border-red-100 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
             <div className="px-6 py-4 border-b border-red-50 bg-red-50/30 flex justify-between items-center">
               <h3 className="text-lg font-semibold text-red-600">Token 列表</h3>
               <span className="text-xs text-red-400">Token 有效期为 30 天</span>
             </div>
             
             <div className="divide-y divide-red-50">
               {Array.isArray(tokensQ.data) && tokensQ.data.map((t: any) => (
                 <div key={t.id} className="p-4 hover:bg-red-50/20 transition-colors flex items-center justify-between group">
                   <div className="flex-1 min-w-0 mr-4">
                     <div className="flex items-center gap-2 mb-1">
                       <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                         {t.env}
                       </span>
                       <span className="text-xs text-gray-400">
                         过期时间: {new Date(t.expires_at).toLocaleString()}
                       </span>
                     </div>
                     <div className="font-mono text-sm text-gray-600 break-all bg-gray-50 p-2 rounded border border-gray-100 flex items-center justify-between">
                        <span className="mr-2">
                          {t.token.length > 24 
                            ? `${t.token.slice(0, 12)}••••••••••••••••••••••••••••••••${t.token.slice(-12)}`
                            : t.token}
                        </span>
                        <button 
                          onClick={() => copyToClipboard(t.token)}
                          className={`p-1.5 rounded-md transition-all ${
                            copiedToken === t.token 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-white text-gray-400 hover:text-blue-600 hover:bg-blue-50 border border-gray-200 shadow-sm'
                          }`}
                          title="复制完整 Token"
                        >
                          {copiedToken === t.token ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                     </div>
                   </div>
                   <button 
                     onClick={() => {
                       if (confirm('确定要删除此 Token 吗？删除后将立即失效。')) {
                         deleteTokenM.mutate(t.id)
                       }
                     }}
                     className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                     title="删除 Token"
                   >
                     <Trash2 className="w-4 h-4" />
                   </button>
                 </div>
               ))}
               {(!tokensQ.data || tokensQ.data.length === 0) && (
                 <div className="p-8 text-center text-gray-400 text-sm">
                   暂无有效 Token，点击上方“生成 Token”创建。
                 </div>
               )}
             </div>
          </div>
        )}

        {viewMode === 'configs' && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-300">
            <ConfigsList serviceCode={code} env={currentEnv} />
          </div>
        )}

        {viewMode === 'ips' && (
            <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                <IpAllowList serviceCode={code!} />
            </div>
        )}
      </div>

      {showDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 relative">
            <h3 className="text-xl font-bold mb-4 text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-6 h-6" />
              确认注销服务？
            </h3>
            <p className="text-gray-600 mb-6">
              此操作将永久删除服务 <strong>{code}</strong> 及其所有配置、版本历史和访问凭证。此操作不可恢复。
            </p>
            <div className="flex justify-end gap-3">
              <button 
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                onClick={() => setShowDelete(false)}
              >
                取消
              </button>
              <button 
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                onClick={() => deleteM.mutate()}
                disabled={deleteM.isPending}
              >
                {deleteM.isPending ? '注销中...' : '确认注销'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTokenGen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 relative">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-green-600">
              <Code2 className="w-6 h-6" />
              Token 已生成
            </h3>
            <p className="text-gray-600 text-sm mb-4">
              请立即复制您的 Token。
            </p>
            
            <div className="mt-4 bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-gray-500 font-medium">Token (Bearer)</span>
                <button 
                  onClick={() => copyToClipboard(generatedToken)} 
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-all font-medium border ${
                    copiedToken === generatedToken
                      ? 'bg-green-100 text-green-700 border-green-200'
                      : 'bg-white text-gray-600 border-gray-200 hover:text-blue-600 hover:border-blue-200 hover:shadow-sm'
                  }`}
                >
                  {copiedToken === generatedToken ? (
                    <>
                      <Check className="w-3 h-3" />
                      已复制
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      复制 Token
                    </>
                  )}
                </button>
              </div>
              <div className="break-all font-mono text-xs text-gray-800 max-h-40 overflow-y-auto bg-white p-3 rounded border border-gray-100 shadow-inner">
                {generatedToken}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button 
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                onClick={() => setShowTokenGen(false)}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
