import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import './Toast.css'

type ToastType = 'error' | 'success' | 'info'
type ToastItem = { id: number; type: ToastType; message: string }

type ToastApi = {
  error: (message: string) => void
  success: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const ICONS: Record<ToastType, typeof AlertCircle> = {
  error: AlertCircle,
  success: CheckCircle2,
  info: Info,
}

/** How long a toast stays up before it dismisses itself. */
const DURATION = 5000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (type: ToastType, message: string) => {
      const id = nextId.current++
      setToasts((list) => [...list, { id, type, message }])
      setTimeout(() => dismiss(id), DURATION)
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({
      error: (message) => push('error', message),
      success: (message) => push('success', message),
      info: (message) => push('info', message),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => {
          const Icon = ICONS[t.type]
          return (
            <div key={t.id} className={`toast toast-${t.type}`}>
              <Icon className="toast-icon" size={18} />
              <span className="toast-msg">{t.message}</span>
              <button
                type="button"
                className="toast-close"
                aria-label="Dismiss"
                onClick={() => dismiss(t.id)}
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

/** Fire a toast from anywhere under <ToastProvider>: `useToast().error('…')`. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
