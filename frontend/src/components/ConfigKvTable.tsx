import { Trash2, Plus } from 'lucide-react'

export interface KvRow {
  key: string
  value: string
}

interface ConfigKvTableProps {
  rows: KvRow[]
  setRows: (rows: KvRow[]) => void
}

export default function ConfigKvTable({ rows, setRows }: ConfigKvTableProps) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-2 text-left font-medium text-gray-500 w-1/3">Key</th>
            <th className="px-4 py-2 text-left font-medium text-gray-500 w-1/3">Value</th>
            <th className="px-4 py-2 text-center font-medium text-gray-500 w-1/3">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, idx) => (
            <tr key={idx} className="group hover:bg-gray-50/50">
              <td className="p-2">
                <input 
                  className="w-full border-gray-200 rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none" 
                  placeholder="key" 
                  value={row.key} 
                  onChange={e => {
                    const newRows = [...rows]
                    newRows[idx].key = e.target.value
                    setRows(newRows)
                  }}
                />
              </td>
              <td className="p-2">
                <input 
                  className="w-full border-gray-200 rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none" 
                  placeholder="value" 
                  value={row.value} 
                  onChange={e => {
                    const newRows = [...rows]
                    newRows[idx].value = e.target.value
                    setRows(newRows)
                  }}
                />
              </td>
              <td className="p-2 text-center">
                <button 
                  onClick={() => {
                    if (rows.length > 1) {
                      const newRows = rows.filter((_, i) => i !== idx)
                      setRows(newRows)
                    } else {
                      // Clear if only one row
                      setRows([{key: '', value: ''}])
                    }
                  }}
                  className="text-gray-400 hover:text-red-600 p-1 rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="bg-gray-50 p-2 border-t border-gray-200 flex justify-center">
        <button 
          onClick={() => setRows([...rows, {key: '', value: ''}])}
          className="flex items-center text-sm text-blue-600 hover:text-blue-700 font-medium px-3 py-1 rounded hover:bg-blue-50 transition-colors"
        >
          <Plus className="w-4 h-4 mr-1" />
          添加配置项
        </button>
      </div>
    </div>
  )
}
