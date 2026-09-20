import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, CheckCircle, XCircle, Loader2, Table } from 'lucide-react'
import toast from 'react-hot-toast'
import { uploadFile } from '../services/api'

function DataPreview({ data }) {
  if (!data?.length) return null
  const cols = Object.keys(data[0])
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100">
      <table className="text-xs w-full">
        <thead className="bg-gray-50">
          <tr>{cols.map(c => <th key={c} className="px-3 py-2 text-left text-gray-600 font-semibold whitespace-nowrap">{c}</th>)}</tr>
        </thead>
        <tbody>
          {data.slice(0, 5).map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              {cols.map(c => <td key={c} className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-[120px] truncate">{String(row[c] ?? '')}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function UploadPage() {
  const [file, setFile] = useState(null)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('idle') // idle | uploading | success | error
  const [result, setResult] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  const onDrop = useCallback((accepted) => {
    if (accepted[0]) { setFile(accepted[0]); setStatus('idle'); setResult(null); setProgress(0); setErrorMessage('') }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'], 'application/vnd.ms-excel': ['.xls'] },
    maxFiles: 1,
  })

  const handleUpload = async () => {
    if (!file) return
    setStatus('uploading')
    setProgress(0)
    setErrorMessage('')
    try {
      const res = await uploadFile(file, setProgress)
      setResult(res.data)
      setStatus('success')
      toast.success(`${res.data.row_count} rows uploaded successfully!`)
    } catch (err) {
      setStatus('error')
      const msg = err.response?.data?.detail || err.message || 'Upload failed. Check if backend is running.'
      setErrorMessage(msg)
      toast.error(msg)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Upload Business Data</h2>
        <p className="text-sm text-gray-500 mt-1">Upload CSV or Excel file — data will auto-embed into AI knowledge base</p>
      </div>

      {/* Dropzone */}
      <div {...getRootProps()} className={`cursor-pointer border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200
        ${isDragActive ? 'border-primary-400 bg-primary-50' : 'border-gray-200 bg-white hover:border-primary-300 hover:bg-gray-50'}`}>
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isDragActive ? 'bg-primary-100' : 'bg-gray-100'}`}>
            <Upload className={`w-7 h-7 ${isDragActive ? 'text-primary-600' : 'text-gray-400'}`} />
          </div>
          {file ? (
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary-600" />
              <span className="font-semibold text-gray-800">{file.name}</span>
              <span className="text-xs text-gray-400">({(file.size / 1024).toFixed(1)} KB)</span>
            </div>
          ) : (
            <>
              <p className="font-semibold text-gray-700">{isDragActive ? 'Drop it here!' : 'Drag & drop your file here'}</p>
              <p className="text-sm text-gray-400">or click to browse</p>
              <p className="text-xs text-gray-300">Supports: .csv, .xlsx, .xls</p>
            </>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {status === 'uploading' && (
        <div className="card space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-gray-700 font-medium"><Loader2 className="w-4 h-4 animate-spin text-primary-600" />Uploading & embedding...</span>
            <span className="text-primary-600 font-bold">{progress}%</span>
          </div>
          <div className="bg-gray-100 rounded-full h-2">
            <div className="bg-primary-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Upload button */}
      {file && status !== 'uploading' && status !== 'success' && (
        <button onClick={handleUpload} className="btn-primary w-full py-3 text-base flex items-center justify-center gap-2">
          <Upload className="w-5 h-5" />
          Upload {file.name}
        </button>
      )}

      {/* Success result */}
      {status === 'success' && result && (
        <div className="card border-emerald-100 bg-emerald-50 space-y-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-emerald-500 flex-shrink-0" />
            <div>
              <p className="font-semibold text-emerald-800">Upload Successful!</p>
              <p className="text-sm text-emerald-700">{result.row_count} rows · {result.columns?.length} columns detected</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {result.columns?.map(col => <span key={col} className="badge badge-green text-xs">{col}</span>)}
          </div>
          {result.data?.length > 0 && (
            <>
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Table className="w-4 h-4" />Data Preview (first 5 rows)
              </div>
              <DataPreview data={result.data} />
            </>
          )}
          <button onClick={() => { setFile(null); setStatus('idle'); setResult(null) }}
            className="btn-secondary w-full text-sm">Upload Another File</button>
        </div>
      )}

      {status === 'error' && (
        <div className="card border-red-100 bg-red-50 flex items-center gap-3">
          <XCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
          <div>
            <p className="font-semibold text-red-800">Upload Failed</p>
            <p className="text-sm text-red-600">{errorMessage || 'Please check file format and try again.'}</p>
          </div>
        </div>
      )}
    </div>
  )
}
