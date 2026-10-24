/** Validate the movie and track durations, without trusting browser metadata. */
export function mp4Duration(buffer: Buffer): number {
  let duration = 0; let timescale = 0; let video = false; let media = false; let format = false
  const tracks: number[] = []
  function walk(start: number, end: number, depth: number) {
    if (depth > 5) throw new Error('MP4 inválido.')
    let pos = start
    while (pos < end) {
      if (pos + 8 > end) throw new Error('MP4 incompleto.')
      let size = buffer.readUInt32BE(pos); const type = buffer.toString('ascii', pos + 4, pos + 8)
      let header = 8
      if (size === 1) { if (pos + 16 > end) throw new Error('MP4 inválido.'); size = Number(buffer.readBigUInt64BE(pos + 8)); header = 16 }
      if (size === 0) size = end - pos
      if (!Number.isSafeInteger(size) || size < header || pos + size > end) throw new Error('MP4 inválido.')
      const data = pos + header; const stop = pos + size
      if (type === 'ftyp' && depth === 0) format = true
      if (type === 'mdat' && size > header && depth === 0) media = true
      if (['moov', 'trak', 'mdia'].includes(type)) walk(data, stop, depth + 1)
      if (type === 'mvhd' || type === 'tkhd') {
        if (data + 4 > stop) throw new Error('MP4 inválido.')
        const version = buffer[data]
        if (version !== 0 && version !== 1) throw new Error('Versão MP4 inválida.')
        const offset = data + (version === 1 ? 20 : 12)
        const durationOffset = offset + (type === 'mvhd' ? 4 : 8)
        if (durationOffset + (version === 1 ? 8 : 4) > stop) throw new Error('MP4 inválido.')
        const ticks = version === 1 ? Number(buffer.readBigUInt64BE(durationOffset)) : buffer.readUInt32BE(durationOffset)
        if (type === 'mvhd') { timescale = buffer.readUInt32BE(offset); duration = ticks }
        else tracks.push(ticks)
      }
      if (type === 'hdlr' && data + 12 <= stop && buffer.toString('ascii', data + 8, data + 12) === 'vide') video = true
      // Fragmented files can declare zero durations; require a conventional exported MP4.
      if (type === 'moof') throw new Error('Exporta o vídeo como MP4 normal, sem fragmentação.')
      pos = stop
    }
  }
  walk(0, buffer.length, 0)
  const seconds = Math.max(duration, ...tracks) / timescale
  if (!format || !media || !video || !timescale || !Number.isFinite(seconds) || seconds <= 0 || seconds > 30) throw new Error('O MP4 tem de conter vídeo e durar até 30 segundos.')
  return seconds
}
