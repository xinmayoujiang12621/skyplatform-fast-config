const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export async function listServices() {
  const r = await fetch(`${API_BASE}/api/v1/services`)
  if (!r.ok) throw new Error('list services failed')
  return r.json()
}

export async function createService(body: { code: string; name: string; owner?: string }) {
  const r = await fetch(`${API_BASE}/api/v1/services`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!r.ok) throw new Error('create service failed')
  return r.json()
}

export async function deleteService(code: string) {
  const r = await fetch(`${API_BASE}/api/v1/services/${code}`, { method: 'DELETE' })
  if (!r.ok) throw new Error('delete service failed')
  return r.json()
}

export async function listCredentials(service: string) {
  const r = await fetch(`${API_BASE}/api/v1/services/${service}/credentials`)
  if (!r.ok) throw new Error('list credentials failed')
  return r.json()
}

export async function generateToken(service: string, env: string) {
  const r = await fetch(`${API_BASE}/api/v1/services/${service}/envs/${env}/token`, { 
    method: 'POST'
  })
  if (!r.ok) throw new Error('generate token failed')
  return r.json()
}

export async function listTokens(service: string) {
  const r = await fetch(`${API_BASE}/api/v1/services/${service}/tokens`)
  if (!r.ok) throw new Error('list tokens failed')
  return r.json()
}

export async function deleteToken(service: string, tokenId: number) {
  const r = await fetch(`${API_BASE}/api/v1/services/${service}/tokens/${tokenId}`, { method: 'DELETE' })
  if (!r.ok) throw new Error('delete token failed')
  return r.json()
}

export async function createConfig(body: { service_code: string; env: string; format: string; content: string; schema_def?: string }) {
  const r = await fetch(`${API_BASE}/api/v1/configs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
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
  const r = await fetch(u.toString())
  if (!r.ok) throw new Error('list configs failed')
  return r.json()
}

export async function updateConfig(id: number, body: { content: string; schema_def?: string; version: number; updated_by?: string }) {
  const r = await fetch(`${API_BASE}/api/v1/configs/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!r.ok) throw new Error('update config failed')
  return r.json()
}

export async function listVersions(id: number) {
  const r = await fetch(`${API_BASE}/api/v1/configs/${id}/versions`)
  if (!r.ok) throw new Error('list versions failed')
  return r.json()
}

export async function rollbackConfig(id: number, version: number, summary?: string) {
  const r = await fetch(`${API_BASE}/api/v1/configs/${id}/rollback`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version, summary }) })
  if (!r.ok) throw new Error('rollback failed')
  return r.json()
}

export async function diffConfig(id: number, from: number, to: number) {
  const r = await fetch(`${API_BASE}/api/v1/configs/${id}/diff?from=${from}&to=${to}`)
  if (!r.ok) throw new Error('diff failed')
  return r.json()
}
