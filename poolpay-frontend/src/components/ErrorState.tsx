import { AlertCircle } from 'lucide-react'

const ErrorState = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <div className="flex flex-col items-center justify-center py-20 gap-4">
    <div className="bg-red-50 rounded-full p-4">
      <AlertCircle className="w-8 h-8 text-red-500" />
    </div>
    <p className="text-slate-600 text-sm">{message}</p>
    <button
      onClick={onRetry}
      className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
    >
      Reintentar
    </button>
  </div>
)

export default ErrorState
