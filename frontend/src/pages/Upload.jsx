import React, { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, CheckCircle2, XCircle, Loader2, Table, Database, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { uploadFile } from '../services/api'

function DataPreview({ data }) {
  if (!data?.length) return null
  const cols = Object.keys(data[0])
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border-color)]">
      <table className="text-xs w-full divide-y divide-[var(--border-color)]">
        <thead className="bg-[var(--bg-surface-elevated)] font-mono text-[10px] uppercase text-[var(--text-dim)]">
          <tr>
            {cols.map((c) => (
              <th key={c} className="px-3.5 py-2.5 text-left font-semibold whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-subtle)] text-[var(--text-main)]">
          {data.slice(0, 6).map((row, i) => (
            <tr key={i} className="hover:bg-[var(--bg-surface-elevated)] transition-colors">
              {cols.map((c) => (
                <td key={c} className="px-3.5 py-2 whitespace-nowrap max-w-[140px] truncate text-[var(--text-muted)] font-mono">
                  {String(row[c] ?? '')}
                </td>
              ))}
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
    if (accepted[0]) {
      setFile(accepted[0])
      setStatus('idle')
      setResult(null)
      setProgress(0)
      setErrorMessage('')
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
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
      toast.success(`${res.data.row_count || 'Ledger'} records ingested into database!`)
    } catch (err) {
      setStatus('error')
      const msg = err.response?.data?.detail || err.message || 'Upload failed. Check if backend database is running.'
      setErrorMessage(msg)
      toast.error(msg)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      className="max-w-3xl mx-auto space-y-6 pb-10"
    >
      {/* Editorial Prologue Header */}
      <div className="border-b-2 border-[var(--border-color)] pb-4">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="font-mono text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 bg-[var(--bg-surface-elevated)] border border-[var(--border-color)]">
            Ingestion Ledger · Records
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl font-extrabold uppercase tracking-tight text-[var(--text-main)] font-display">
          Upload Sales & Inventory Ledgers
        </h1>
        <p className="text-xs text-[var(--text-muted)] mt-0.5 font-mono uppercase tracking-wide">
          Import CSV or Excel spreadsheets into your store database.
        </p>
      </div>

      {/* Drag & Drop Zone */}
      <div
        {...getRootProps()}
        className={`cursor-pointer border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200 os-surface ${
          isDragActive
            ? 'border-[var(--accent)] bg-[var(--accent-subtle)]'
            : 'border-[var(--border-color)] hover:border-[var(--border-strong)]'
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-transform ${
              isDragActive
                ? 'bg-[var(--accent)] text-[var(--accent-ink)] border border-[var(--border-strong)] scale-110'
                : 'bg-[var(--bg-surface-elevated)] text-[var(--text-main)] border border-[var(--border-color)]'
            }`}
          >
            <Upload className="w-6 h-6" />
          </div>

          {file ? (
            <div className="flex items-center gap-2 bg-[var(--bg-surface-elevated)] px-4 py-2 rounded-lg border border-[var(--border-color)]">
              <FileText className="w-4 h-4 text-[var(--accent)]" />
              <span className="font-semibold text-xs text-[var(--text-main)]">{file.name}</span>
              <span className="text-[10px] font-mono text-[var(--text-dim)]">
                ({(file.size / 1024).toFixed(1)} KB)
              </span>
            </div>
          ) : (
            <>
              <p className="font-semibold text-sm text-[var(--text-main)]">
                {isDragActive ? 'Drop sales spreadsheet here' : 'Drag & drop transaction ledger here'}
              </p>
              <p className="text-xs text-[var(--text-muted)]">or click to browse your local computer</p>
              <p className="text-[10px] font-mono text-[var(--text-dim)]">Supports .csv, .xlsx, .xls</p>
            </>
          )}
        </div>
      </div>

      {/* Upload Progress Bar */}
      {status === 'uploading' && (
        <div className="os-surface p-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-[var(--text-muted)]">Importing and analyzing records...</span>
            <span className="font-bold text-[var(--accent)]">{progress}%</span>
          </div>
          <div className="w-full bg-[var(--bg-surface-elevated)] rounded-full h-2 overflow-hidden">
            <div
              className="bg-[var(--accent)] h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Upload Trigger Button */}
      {file && status !== 'uploading' && status !== 'success' && (
        <div className="flex justify-end">
          <button
            onClick={handleUpload}
            className="btn-accent text-xs font-semibold py-2.5 px-6 cursor-pointer"
          >
            <span>Process & Ingest File</span>
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Success State & Preview */}
      {status === 'success' && result && (
        <div className="os-surface p-5 space-y-4">
          <div className="flex items-center gap-3 text-emerald-500">
            <CheckCircle2 className="w-6 h-6 shrink-0" />
            <div>
              <h4 className="font-bold text-sm text-[var(--text-main)]">
                Ledger Ingested Successfully
              </h4>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {result.row_count || 'All'} rows processed and updated in your store database.
              </p>
            </div>
          </div>

          {result.preview && result.preview.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)] font-semibold block">
                Ingested Table Sample Preview
              </span>
              <DataPreview data={result.preview} />
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              onClick={() => {
                setFile(null)
                setStatus('idle')
                setResult(null)
              }}
              className="btn-ghost text-xs cursor-pointer"
            >
              Upload Another Ledger
            </button>
          </div>
        </div>
      )}

      {/* Error state */}
      {status === 'error' && (
        <div className="os-surface p-4 border border-red-500/30 bg-red-500/10 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-bold text-red-500">Ingestion Failure</span>
            <p className="text-[var(--text-muted)] mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}
    </motion.div>
  )
}
