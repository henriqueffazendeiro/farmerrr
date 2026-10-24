// Original procedural score: 100 BPM, A minor, 90 seconds. No samples.
const fs = require('node:fs')
const rate = 22050, seconds = 90, samples = rate * seconds
const output = Buffer.alloc(44 + samples * 2)
output.write('RIFF'); output.writeUInt32LE(output.length - 8, 4); output.write('WAVEfmt ', 8)
output.writeUInt32LE(16, 16); output.writeUInt16LE(1, 20); output.writeUInt16LE(1, 22)
output.writeUInt32LE(rate, 24); output.writeUInt32LE(rate * 2, 28); output.writeUInt16LE(2, 32); output.writeUInt16LE(16, 34)
output.write('data', 36); output.writeUInt32LE(samples * 2, 40)
const chords = [[220, 261.63, 329.63], [174.61, 220, 261.63], [130.81, 164.81, 196], [196, 246.94, 293.66]]
let seed = 71
for (let i = 0; i < samples; i++) {
  const t = i / rate, beat = t % .6, step = t % .3
  const chord = chords[Math.floor(t / 9.6) % chords.length]
  const envelope = Math.min(1, t / 3, (90 - t) / 4)
  const tension = t < 12 ? .2 : t < 40 ? .65 : t < 46 ? .18 : t < 73 ? .8 : .5
  let v = chord.reduce((sum, f, j) => sum + Math.sin(2 * Math.PI * f * .5 * t + Math.sin(t * .4 + j) * .2), 0) * .038
  const note = chord[Math.floor(t / .3) % 3] * (Math.floor(t / 1.2) % 2 ? 2 : 1)
  v += Math.sin(2 * Math.PI * note * step) * Math.exp(-step * 13) * .1 * tension
  v += Math.sin(2 * Math.PI * (48 * beat + 5 * (1 - Math.exp(-beat * 35)))) * Math.exp(-beat * 14) * .3 * tension
  seed = (1664525 * seed + 1013904223) >>> 0
  v += (seed / 4294967296 * 2 - 1) * Math.exp(-step * 90) * .035 * tension
  const swell = Math.max(0, 1 - Math.abs(t - 40) / 2)
  v += Math.sin(2 * Math.PI * 55 * t) * swell * .12
  output.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v * envelope)) * 32767), 44 + i * 2)
}
fs.mkdirSync('public/recap', { recursive: true })
fs.writeFileSync('public/recap/first-cut.wav', output)
console.log('Original score: 90 seconds, PCM mono 22050 Hz')
