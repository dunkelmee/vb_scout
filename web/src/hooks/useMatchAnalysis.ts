import { useQuery } from '@tanstack/react-query'
import { gamesApi, MatchAnalysis } from '../lib/api'

export function useMatchAnalysis(matchId: string | undefined) {
  return useQuery<MatchAnalysis>({
    queryKey: ['analysis', matchId],
    queryFn: () => gamesApi.analysis(matchId!),
    enabled: !!matchId,
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return 3000
      if (data.status === 'pending' || data.status === 'running') return 3000
      return false
    },
    staleTime: 0,
  })
}
