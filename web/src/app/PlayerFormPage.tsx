import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { playersApi } from '../lib/api'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { ChipGroup } from '../components/ui/Select'
import { PlayerAvatar } from '../components/players/PlayerAvatar'
import { useToast } from '../components/ui/Toast'
import { ArrowLeft, Camera, Trash2 } from 'lucide-react'
import { useRole } from '../hooks/useRole'

const POSITION_OPTIONS = ['Setter', 'Outside', 'Opposite', 'Middle', 'Libero', 'DS']

export function PlayerFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { showToast } = useToast()
  const { isManager } = useRole()
  const isEdit = !!id

  const [firstName, setFirstName]           = useState('')
  const [lastName, setLastName]             = useState('')
  const [jersey, setJersey]                 = useState('')
  const [birthday, setBirthday]             = useState('')
  const [heightM, setHeightM]               = useState('')
  const [positions, setPositions]           = useState<string[]>([])
  const [isLibero, setIsLibero]             = useState(false)
  const [hasRefereeLicense, setHasRef]      = useState(false)

  // Local preview of a newly-chosen photo (before save)
  const [photoPreview, setPhotoPreview]     = useState<string | null>(null)
  const [pendingPhoto, setPendingPhoto]     = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: player } = useQuery({
    queryKey: ['player', id],
    queryFn: () => playersApi.get(id!),
    enabled: isEdit,
  })

  useEffect(() => {
    if (player) {
      setFirstName(player.firstName)
      setLastName(player.lastName)
      setJersey(player.jersey?.toString() || '')
      setBirthday(player.birthday ? player.birthday.slice(0, 10) : '')
      setHeightM(player.heightM?.toString() || '')
      setPositions(player.positions)
      setIsLibero(player.isLibero)
      setHasRef(player.hasRefereeLicense)
    }
  }, [player])

  // ── Photo upload mutation ─────────────────────────────────────────────────
  const photoMutation = useMutation({
    mutationFn: (file: File) => playersApi.uploadPhoto(id!, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['players'] })
      qc.invalidateQueries({ queryKey: ['player', id] })
      setPhotoPreview(null)
      setPendingPhoto(null)
      showToast('Photo saved', 'success')
    },
    onError: () => showToast('Failed to upload photo', 'error'),
  })

  const deletePhotoMutation = useMutation({
    mutationFn: () => playersApi.deletePhoto(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['players'] })
      qc.invalidateQueries({ queryKey: ['player', id] })
      setPhotoPreview(null)
      setPendingPhoto(null)
      showToast('Photo removed', 'success')
    },
    onError: () => showToast('Failed to remove photo', 'error'),
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
    // Reset input so the same file can be picked again
    e.target.value = ''
  }

  // ── Profile save mutations ────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async () => {
      const p = await playersApi.create({
        firstName, lastName,
        jersey: jersey ? parseInt(jersey) : undefined,
        birthday: birthday || undefined,
        heightM: heightM ? parseFloat(heightM) : undefined,
        positions, isLibero, hasRefereeLicense,
      })
      // Upload pending photo using the newly-created player's ID
      if (pendingPhoto) {
        await playersApi.uploadPhoto(p.id, pendingPhoto)
      }
      return p
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['players'] })
      navigate('/players')
    },
  })

  const updateMutation = useMutation({
    mutationFn: () => playersApi.update(id!, {
      firstName, lastName,
      jersey: jersey ? parseInt(jersey) : undefined,
      birthday: birthday || undefined,
      heightM: heightM ? parseFloat(heightM) : undefined,
      positions, isLibero, hasRefereeLicense,
    }),
    onSuccess: async () => {
      // If there's a pending photo, upload it now
      if (pendingPhoto) {
        await playersApi.uploadPhoto(id!, pendingPhoto)
      }
      qc.invalidateQueries({ queryKey: ['players'] })
      qc.invalidateQueries({ queryKey: ['player', id] })
      navigate('/players')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isEdit) updateMutation.mutate()
    else createMutation.mutate()
  }

  const isLoading = createMutation.isPending || updateMutation.isPending

  const handlePositions = (pos: string[]) => {
    setPositions(pos)
    setIsLibero(pos.includes('Libero'))
  }

  // Displayed avatar: pending local preview > saved URL > placeholder
  const displayedPlayer = {
    firstName: firstName || player?.firstName || '',
    lastName: lastName || player?.lastName || '',
    jersey: player?.jersey ?? null,
    avatarUrl: photoPreview ?? player?.avatarUrl ?? null,
  }
  const hasPhoto = !!(photoPreview || player?.avatarUrl)

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <div className="px-4 pt-safe-top pt-4 pb-3 flex items-center gap-2 border-b border-outline/10">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-surface-high flex items-center justify-center shrink-0 active:scale-95 transition-transform">
          <ArrowLeft size={18} className="text-on-surface-variant" />
        </button>
        <h1 className="font-display font-bold text-base text-on-surface">
          {isEdit ? 'Edit Player' : 'Add Player'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {/* ── Photo picker (managers only, edit mode) ── */}
        {isManager && (
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="relative">
              <PlayerAvatar player={displayedPlayer} size="xl" showJerseyBadge />

              {/* Camera overlay button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-orange flex items-center justify-center shadow-md active:scale-95 transition-transform"
              >
                <Camera size={15} className="text-white" />
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-orange font-bold"
              >
                {hasPhoto ? 'Change photo' : 'Add photo'}
              </button>

              {/* Direct upload for existing players with a pending or saved photo */}
              {isEdit && pendingPhoto && (
                <button
                  type="button"
                  onClick={() => photoMutation.mutate(pendingPhoto)}
                  disabled={photoMutation.isPending}
                  className="text-xs text-secondary-container font-bold"
                >
                  {photoMutation.isPending ? 'Uploading…' : 'Save photo now'}
                </button>
              )}

              {isEdit && hasPhoto && !pendingPhoto && (
                <button
                  type="button"
                  onClick={() => deletePhotoMutation.mutate()}
                  disabled={deletePhotoMutation.isPending}
                  className="text-xs text-error/70 font-bold flex items-center gap-1"
                >
                  <Trash2 size={11} /> Remove
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Profile fields ── */}
        <div className="grid grid-cols-2 gap-3">
          <Input label="First name" value={firstName} onChange={e => setFirstName(e.target.value)} required />
          <Input label="Last name"  value={lastName}  onChange={e => setLastName(e.target.value)}  required />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Input label="Jersey #"   type="number" value={jersey}   onChange={e => setJersey(e.target.value)}   placeholder="7" />
          <Input label="Height (m)" type="number" value={heightM}  onChange={e => setHeightM(e.target.value)}  step="0.01" placeholder="1.85" />
          <Input label="Birthday"   type="date"   value={birthday} onChange={e => setBirthday(e.target.value)} />
        </div>

        <ChipGroup
          label="Positions"
          options={POSITION_OPTIONS}
          selected={positions}
          onChange={handlePositions}
        />

        <label className="flex items-center gap-3 text-sm text-on-surface cursor-pointer">
          <input
            type="checkbox"
            checked={hasRefereeLicense}
            onChange={e => setHasRef(e.target.checked)}
            className="w-4 h-4 accent-orange"
          />
          Has referee license
        </label>


        <div className="flex gap-3 pt-2">
          <Button variant="outline" type="button" onClick={() => navigate(-1)} className="flex-1">
            Cancel
          </Button>
          <Button
            type="submit"
            loading={isLoading}
            disabled={!firstName || !lastName || positions.length === 0}
            className="flex-1"
          >
            {isEdit ? 'Save' : 'Add player'}
          </Button>
        </div>
      </form>
    </div>
  )
}
