import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { trainingsApi } from '../lib/api'
import { Button } from '../components/ui/Button'
import { Input, Textarea } from '../components/ui/Input'
import { ChipGroup } from '../components/ui/Select'
import { ArrowLeft } from 'lucide-react'

const FOCUS_OPTIONS = ['Serve', 'Reception', 'Attack', 'Block', 'Defence', 'Rotation', 'Fitness', 'Set piece']

export function TrainingFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const isEdit = !!id

  const [title, setTitle] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [startTime, setStartTime] = useState('18:00')
  const [endTime, setEndTime] = useState('20:00')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [focusTags, setFocusTags] = useState<string[]>([])

  const { data: existing } = useQuery({
    queryKey: ['training', id],
    queryFn: () => trainingsApi.get(id!),
    enabled: isEdit,
  })

  useEffect(() => {
    if (existing) {
      setTitle(existing.title)
      setDate(typeof existing.date === 'string' ? existing.date.slice(0, 10) : '')
      setStartTime(existing.startTime)
      setEndTime(existing.endTime || '')
      setLocation(existing.location || '')
      setNotes(existing.notes || '')
      setFocusTags(existing.focusTags)
    }
  }, [existing])

  const createMutation = useMutation({
    mutationFn: () => trainingsApi.create({ title, date, startTime, endTime: endTime || undefined, location: location || undefined, notes: notes || undefined, focusTags }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trainings'] })
      navigate('/trainings')
    },
  })

  const updateMutation = useMutation({
    mutationFn: () => trainingsApi.update(id!, { title, date, startTime, endTime: endTime || undefined, location: location || undefined, notes: notes || undefined, focusTags }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trainings'] })
      qc.invalidateQueries({ queryKey: ['training', id] })
      navigate(`/trainings/${id}`)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isEdit) updateMutation.mutate()
    else createMutation.mutate()
  }

  const isLoading = createMutation.isPending || updateMutation.isPending

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {/* Header */}
      <div className="px-4 pt-safe-top pt-4 pb-3 flex items-center gap-2 border-b border-outline/10">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-surface-high flex items-center justify-center shrink-0 active:scale-95 transition-transform">
          <ArrowLeft size={18} className="text-on-surface-variant" />
        </button>
        <h1 className="font-display font-bold text-base text-on-surface">
          {isEdit ? 'Edit Training' : 'New Training Session'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <Input label="Title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Serve & Reception Drill" required />
        <Input label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Start time" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required />
          <Input label="End time (optional)" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
        </div>
        <Input label="Location" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Main gym" />
        <ChipGroup
          label="Focus tags"
          options={FOCUS_OPTIONS}
          selected={focusTags}
          onChange={setFocusTags}
        />
        <Textarea label="Notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Describe the session plan..." rows={4} />

        <div className="flex gap-3 pt-2 pb-safe">
          <Button variant="outline" type="button" onClick={() => navigate(-1)} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" loading={isLoading} className="flex-1">
            {isEdit ? 'Save changes' : 'Create session'}
          </Button>
        </div>
      </form>
    </div>
  )
}
