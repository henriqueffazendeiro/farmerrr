export type RecapVideo = {
  id: string; participantId: string; name: string; avatar: string | null;
  thumbnail: string | null; caption: string | null; url: string | null;
  views: number; likes: number; shares: number; comments: number;
}
export type RecapSnapshot = { videos: RecapVideo[] }
export type MonthlyRecap = {
  id: string; leaderboard_id: string; period_key: string; snapshot: RecapSnapshot;
  created_at: string; winner_video_path: string | null;
}
export function summarizeRecap(snapshot: RecapSnapshot) {
  const people = new Map<string, { id: string; name: string; avatar: string | null; views: number; clips: number }>()
  const totals = { views: 0, likes: 0, shares: 0, comments: 0, clips: snapshot.videos.length }
  for (const v of snapshot.videos) {
    for (const metric of ['views', 'likes', 'shares', 'comments'] as const) totals[metric] += v[metric]
    const person = people.get(v.participantId) ?? { id: v.participantId, name: v.name, avatar: v.avatar, views: 0, clips: 0 }
    person.views += v.views; person.clips++
    people.set(person.id, person)
  }
  const ranking = [...people.values()].sort((a, b) => b.views - a.views || b.clips - a.clips || a.id.localeCompare(b.id))
  const best = (metric: 'views' | 'likes' | 'shares') => [...snapshot.videos].sort((a, b) => b[metric] - a[metric] || a.id.localeCompare(b.id))[0] ?? null
  return { totals, ranking, winner: ranking[0] ?? null,
    mostActive: [...ranking].sort((a, b) => b.clips - a.clips || b.views - a.views || a.id.localeCompare(b.id))[0] ?? null,
    mostViewed: best('views'), mostLiked: best('likes'), mostShared: best('shares') }
}
