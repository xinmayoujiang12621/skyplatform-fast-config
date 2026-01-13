import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Box, LogOut, Bell, Globe, Server } from 'lucide-react'
import { ReactNode } from 'react'
import { useEnv } from '../context/EnvContext'
import { useAuth } from '../context/AuthContext'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const path = location.pathname
  const { currentEnv, setEnv, envOptions } = useEnv()
  const { logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const menus = [
    { name: '服务概览', path: '/', icon: LayoutDashboard },
    { name: 'Token监控', path: '/tokens-monitor', icon: Bell },
    { name: '后端地址映射', path: '/backend-bases', icon: Server },
  ]

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans text-gray-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-100 flex flex-col shadow-sm z-10">
        <div className="h-16 flex items-center px-6 border-b border-gray-50">
          <Box className="w-6 h-6 text-blue-600 mr-3" />
          <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Fast Config</span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {menus.map((m) => {
            const active = path === m.path
            const Icon = m.icon
            return (
              <Link
                key={m.path}
                to={m.path}
                className={`flex items-center px-4 py-3 rounded-xl transition-all duration-200 group ${
                  active
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-blue-600'
                }`}
              >
                <Icon className={`w-5 h-5 mr-3 transition-colors ${active ? 'text-white' : 'text-gray-400 group-hover:text-blue-600'}`} />
                <span className="font-medium">{m.name}</span>
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-gray-50">
          <div className="flex items-center px-4 py-3 rounded-xl bg-gray-50 text-gray-600">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold mr-3">
              A
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">Admin User</div>
              <div className="text-xs text-gray-400">DevOps Engineer</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-8 shadow-sm z-0">
          <div className="flex items-center">
             <h2 className="text-xl font-semibold text-gray-800">
               {menus.find(m => m.path === path)?.name || (path.startsWith('/services/') ? '服务详情' : '控制台')}
             </h2>
          </div>
          <div className="flex items-center gap-4">
             {/* Env Selector - Only show on service detail pages */}
             {path.startsWith('/services/') && (
               <div className="flex items-center bg-gray-50 rounded-lg px-2 py-1 border border-gray-200">
                  <Globe className="w-4 h-4 text-gray-400 mr-2" />
                  <select 
                    value={currentEnv}
                    onChange={(e) => setEnv(e.target.value)}
                    className="bg-transparent text-sm text-gray-700 font-medium focus:outline-none cursor-pointer"
                  >
                    {envOptions.map(env => (
                      <option key={env} value={env}>{env}</option>
                    ))}
                  </select>
               </div>
             )}

             <div className="h-8 w-px bg-gray-200 mx-2"></div>

             <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
               <Bell className="w-5 h-5" />
             </button>
             <button 
                onClick={handleLogout}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 ml-2"
             >
               <LogOut className="w-4 h-4" />
               <span>退出</span>
             </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-8 scroll-smooth no-scrollbar">
           <div className="max-w-6xl mx-auto space-y-6">
              {children}
           </div>
        </main>
      </div>
    </div>
  )
}
