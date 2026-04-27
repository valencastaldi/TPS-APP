const Spinner = ({ text = 'Cargando...' }: { text?: string }) => (
  <div className="flex flex-col items-center justify-center py-20 gap-3">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
    <p className="text-sm text-slate-500">{text}</p>
  </div>
)

export default Spinner
