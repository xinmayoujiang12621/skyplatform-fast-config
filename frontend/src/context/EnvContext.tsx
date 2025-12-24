import { createContext, useContext, useState, ReactNode } from 'react'

interface EnvContextType {
  currentEnv: string
  setEnv: (env: string) => void
  envOptions: string[]
}

const EnvContext = createContext<EnvContextType | undefined>(undefined)

export const ENV_OPTIONS = ['dev', 'test', 'stage', 'prod']

export function EnvProvider({ children }: { children: ReactNode }) {
  const [currentEnv, setEnv] = useState('prod')

  return (
    <EnvContext.Provider value={{ currentEnv, setEnv, envOptions: ENV_OPTIONS }}>
      {children}
    </EnvContext.Provider>
  )
}

export function useEnv() {
  const context = useContext(EnvContext)
  if (context === undefined) {
    throw new Error('useEnv must be used within an EnvProvider')
  }
  return context
}
