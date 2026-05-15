import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

interface ConfirmModalProps {
  open: boolean
  title: string
  description?: string | React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'primary' | 'danger' | 'success'
  /** Si se pasa, se muestra un input de texto con este placeholder y la respuesta se envía a onConfirm. */
  inputPlaceholder?: string
  /** Etiqueta encima del input (opcional). */
  inputLabel?: string
  onConfirm: (inputValue?: string) => void | Promise<void>
  onCancel: () => void
}

const variantStyles = {
  primary: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
  success: 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500',
  danger:  'bg-red-600 hover:bg-red-700 focus:ring-red-500',
}

const ConfirmModal = ({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'primary',
  inputPlaceholder,
  inputLabel,
  onConfirm,
  onCancel,
}: ConfirmModalProps) => {
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset al abrir
  useEffect(() => {
    if (open) {
      setInputValue('')
      setLoading(false)
      // foco al input si existe, sino al botón confirm
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // ESC cierra
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await onConfirm(inputPlaceholder ? inputValue : undefined)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600 transition-colors -m-1 p-1"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-3">
          {description && (
            <div className="text-sm text-slate-600 leading-relaxed">{description}</div>
          )}

          {inputPlaceholder && (
            <div>
              {inputLabel && (
                <label className="block text-xs font-medium text-slate-700 mb-1.5 uppercase tracking-wide">
                  {inputLabel}
                </label>
              )}
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder={inputPlaceholder}
                onKeyDown={e => { if (e.key === 'Enter') handleConfirm() }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 ${variantStyles[variant]}`}
          >
            {loading ? 'Procesando...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmModal
