const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

async function request(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('admin_token')
  const headers = new Headers(options.headers || {})
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const r = await fetch(url, { ...options, headers })

  if (r.status === 401) {
    if (!path.includes('/auth/login')) {
      // 触发退出登录逻辑（这里简单处理为跳转）
      localStorage.removeItem('admin_token')
      window.location.href = '/login'
    }
  }
  
  return r
}

export async function listServices() {
  const r = await request('/api/v1/services')
  if (!r.ok) throw new Error('list services failed')
  return r.json()
}

export async function createService(body: { code: string; name: string; owner?: string }) {
  const r = await request('/api/v1/services', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!r.ok) throw new Error('create service failed')
  return r.json()
}

export async function deleteService(code: string) {
  const r = await request(`/api/v1/services/${code}`, { method: 'DELETE' })
  if (!r.ok) throw new Error('delete service failed')
  return r.json()
}

export async function listCredentials(service: string) {
  const r = await request(`/api/v1/services/${service}/credentials`)
  if (!r.ok) throw new Error('list credentials failed')
  return r.json()
}

export async function generateToken(service: string, env: string) {
  const r = await request(`/api/v1/services/${service}/envs/${env}/token`, { 
    method: 'POST'
  })
  if (!r.ok) throw new Error('generate token failed')
  return r.json()
}

export async function listTokens(service: string) {
  const r = await request(`/api/v1/services/${service}/tokens`)
  if (!r.ok) throw new Error('list tokens failed')
  return r.json()
}

export async function deleteToken(service: string, tokenId: number) {
  const r = await request(`/api/v1/services/${service}/tokens/${tokenId}`, { method: 'DELETE' })
  if (!r.ok) throw new Error('delete token failed')
  return r.json()
}

export async function createConfig(body: { service_code: string; env: string; format: string; content: string; schema_def?: string }) {
  const r = await request('/api/v1/configs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!r.ok) {
    if (r.status === 409) {
      const err = await r.json().catch(() => ({ detail: 'Config already exists' }))
      throw new Error(err.detail || 'Config already exists')
    }
    throw new Error('create config failed')
  }
  return r.json()
}

export async function listConfigs(params: { service?: string; env?: string }) {
  const u = new URL(`${API_BASE}/api/v1/configs`)
  if (params.service) u.searchParams.set('service', params.service)
  if (params.env) u.searchParams.set('env', params.env)
  const r = await request(u.toString())
  if (!r.ok) throw new Error('list configs failed')
  return r.json()
}

export async function updateConfig(id: number, body: { content: string; schema_def?: string; version: number; updated_by?: string }) {
  const r = await request(`/api/v1/configs/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!r.ok) throw new Error('update config failed')
  return r.json()
}
 
export async function importConfigText(body: { service_code: string; env: string; text: string; overwrite?: boolean; updated_by?: string }) {
  const r = await request('/api/v1/configs/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!r.ok) throw new Error('import config failed')
  return r.json()
}

export async function listVersions(id: number) {
  const r = await request(`/api/v1/configs/${id}/versions`)
  if (!r.ok) throw new Error('list versions failed')
  return r.json()
}

export async function rollbackConfig(id: number, version: number, summary?: string) {
  const r = await request(`/api/v1/configs/${id}/rollback`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version, summary }) })
  if (!r.ok) throw new Error('rollback failed')
  return r.json()
}

export async function diffConfig(id: number, from: number, to: number) {
  const r = await request(`/api/v1/configs/${id}/diff?from=${from}&to=${to}`)
  if (!r.ok) throw new Error('diff failed')
  return r.json()
}

export interface AllowIP {
  id: number
  cidr: string
  env?: string
  note?: string
  created_at: string
}

export async function listAllowIps(service: string, env?: string) {
  const u = new URL(`${API_BASE}/api/v1/services/${service}/allow-ips`)
  if (env) u.searchParams.set('env', env)
  const r = await request(u.toString())
  if (!r.ok) throw new Error('list allow ips failed')
  return r.json() as Promise<AllowIP[]>
}

export async function addAllowIp(service: string, body: { cidr: string; env?: string; note?: string }) {
  const r = await request(`/api/v1/services/${service}/allow-ips`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!r.ok) {
     if (r.status === 409) throw new Error('Rule already exists')
     if (r.status === 400) throw new Error('Invalid CIDR/IP')
     throw new Error('add allow ip failed')
  }
  return r.json() as Promise<AllowIP>
}

export async function deleteAllowIp(service: string, id: number) {
  const r = await request(`/api/v1/services/${service}/allow-ips/${id}`, { method: 'DELETE' })
  if (!r.ok) throw new Error('delete allow ip failed')
  return r.json()
}

export async function login(username: string, password: string): Promise<{ token: string, expires_at: string }> {
  // Login still uses request but token won't be set if not logged in, or ignored by backend
  // But wait, if we are logged in as someone else, we send the token. Backend ignores it for login endpoint.
  // And 401 handling in request excludes /auth/login path.
  const r = await request('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
  if (!r.ok) {
    if (r.status === 401) throw new Error('Invalid credentials')
    throw new Error('Login failed')
  }
  return r.json()
}
