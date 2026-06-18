import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, AlertTriangle, type LucideIcon } from 'lucide-react'
import { cn } from './cn'

export interface ConfirmDialogItem {
  icon?: LucideIcon
  label: React.ReactNode
}

interface ConfirmDialogProps {
  open: boolean
  title: string
  /** What will be removed — rendered above the standard "cannot be undone" line. */
  message?: React.ReactNode
  /** Related entities that get deleted alongside the object (cascade). */
  items?: ConfirmDialogItem[]
  /**
   * When set, the dialog becomes a guarded "type-to-confirm" delete: the user
   * must type this exact string (the team's name) to enable the Delete button.
   * Used for cascade deletes that remove related entities.
   */
  confirmName?: string
  confirmLabel?: string
  loading?: boolean
  onConfirm: () => void
  onClose: () => void
}

/**
 * Themed destructive-confirmation dialog. Replaces window.confirm().
 *
 * Two automatic tiers:
 *  - simple  → no `confirmName`; a single Delete tap.
 *  - cascade → `confirmName` set; lists related entities and requires typing
 *              the team's name to confirm.
 */
export function ConfirmDialog({
  open, title, message, items, confirmName, confirmLabel, loading,
  onConfirm, onClose,
}: ConfirmDialogProps) {
  const { t } = useTranslation()
  const [typed, setTyped] = useState('')

  useEffect(() => { if (!open) setTyped('') }, [open])

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !loading) onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [open, loading, onClose])

  if (!open) return null

  const cascade = !!confirmName
  const Icon = cascade ? AlertTriangle : Trash2
  const confirmDisabled = loading || (cascade && typed.trim() !== confirmName)

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-5"
      style={{ background: 'rgba(7,6,0,0.72)', backdropFilter: 'blur(3px)' }}
      onClick={() => { if (!loading) onClose() }}
    >
      <div
        className="w-full max-w-[340px] rounded-[22px] p-[22px] animate-slide-up"
        style={{
          background: '#1a1815',
          border: cascade ? '1px solid rgba(234,82,111,0.22)' : '1px solid rgba(247,247,255,0.08)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        {cascade ? (
          <div className="flex items-center gap-3 mb-3.5">
            <div className="w-[46px] h-[46px] rounded-xl flex items-center justify-center shrink-0 bg-bubb-500/15 border border-bubb-500/30">
              <Icon size={22} className="text-bubb-500" />
            </div>
            <h3 className="font-display font-black text-[17px] text-on-surface leading-tight">{title}</h3>
          </div>
        ) : (
          <div className="text-center">
            <div className="w-14 h-14 rounded-full mx-auto mb-3.5 flex items-center justify-center bg-bubb-500/[0.12] border border-bubb-500/25">
              <Icon size={24} className="text-bubb-500" />
            </div>
            <h3 className="font-display font-black text-[17px] text-on-surface mb-1.5">{title}</h3>
          </div>
        )}

        {/* Related-entity impact list */}
        {items && items.length > 0 && (
          <div className="rounded-xl bg-bubb-500/[0.06] border border-bubb-500/20 px-3.5 py-1 mb-3">
            {items.map((it, i) => (
              <div key={i} className="flex items-center gap-2 py-1.5 text-[12.5px] text-on-surface-variant">
                {it.icon && <it.icon size={15} className="text-bubb-400 shrink-0" />}
                <span>{it.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Body */}
        {message && (
          <p className={cn('text-[13px] text-on-surface-variant leading-relaxed mb-2', !cascade && 'text-center')}>
            {message}
          </p>
        )}
        <p className={cn('text-[12px] font-semibold text-bubb-400 mb-4', !cascade && 'text-center')}>
          {t('confirm.cannotBeUndone')}
        </p>

        {/* Type-to-confirm (cascade) */}
        {cascade && (
          <>
            <p className="text-[11.5px] text-on-surface-variant mb-1.5">
              {t('confirm.typeToConfirm', { name: confirmName })}
            </p>
            <input
              value={typed}
              onChange={e => setTyped(e.target.value)}
              placeholder={confirmName}
              autoComplete="off"
              autoFocus
              className="w-full rounded-[10px] px-3 py-2.5 text-[14px] text-on-surface bg-background border border-outline outline-none focus:border-bubb-500 mb-4 font-mono"
            />
          </>
        )}

        {/* Actions */}
        <div className="flex gap-2.5">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-3 rounded-[13px] text-[13.5px] font-bold bg-white/5 border border-outline text-on-surface-variant disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onConfirm}
            disabled={confirmDisabled}
            className="flex-1 py-3 rounded-[13px] text-[13.5px] font-bold bg-bubb-500 text-pitch-950 disabled:opacity-40 active:scale-[0.98] transition-transform"
          >
            {loading ? '…' : (confirmLabel || t('common.delete'))}
          </button>
        </div>
      </div>
    </div>
  )
}
