const { test } = require('node:test')
const assert = require('node:assert/strict')
const ts = require('typescript')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')
function load(file) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
  const result = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
  const exports = {}; vm.runInNewContext(result.outputText, { exports, Buffer, require }); return exports
}
const { summarizeRecap } = load('src/lib/recap/model.ts')
const { mp4Duration } = load('src/lib/recap/mp4.ts')
const video = (id, participantId, views, likes = 0, shares = 0) => ({ id, participantId, name: participantId, avatar: null, thumbnail: null, caption: '', url: null, views, likes, shares, comments: 0 })
test('awards use all clips; winner, likes, shares and most active are independent', () => {
  const videos = [video('1', 'a', 100), video('2', 'b', 60, 50), video('3', 'b', 60), video('4', 'c', 1, 0, 80), video('5', 'c', 1), video('6', 'c', 1)]
  const result = summarizeRecap({ videos })
  assert.equal(result.winner.id, 'b'); assert.equal(result.mostViewed.id, '1')
  assert.equal(result.mostLiked.id, '2'); assert.equal(result.mostShared.id, '4')
  assert.equal(result.mostActive.id, 'c'); assert.equal(result.totals.views, 223)
  assert.equal(result.totals.clips, 6); assert.equal(result.ranking.length, 3)
})
test('ties use clip count then stable participant ID regardless of input order', () => {
  const videos = [video('1', 'z', 100), video('2', 'b', 50), video('3', 'b', 50), video('4', 'a', 50), video('5', 'a', 50)]
  assert.equal(summarizeRecap({ videos }).winner.id, 'a')
  assert.equal(summarizeRecap({ videos: videos.reverse() }).winner.id, 'a')
})
test('empty month has no invented winner', () => {
  const recap = summarizeRecap({ videos: [] })
  assert.equal(recap.winner, null); assert.equal(recap.mostViewed, null); assert.equal(recap.totals.views, 0)
})
function box(type, data) { const h = Buffer.alloc(8); h.writeUInt32BE(8 + data.length); h.write(type, 4); return Buffer.concat([h, data]) }
function mp4(seconds, trackSeconds = seconds) {
  const mvhd = Buffer.alloc(100); mvhd.writeUInt32BE(1000, 12); mvhd.writeUInt32BE(seconds * 1000, 16)
  const tkhd = Buffer.alloc(84); tkhd.writeUInt32BE(trackSeconds * 1000, 20)
  const hdlr = Buffer.alloc(24); hdlr.write('vide', 8)
  return Buffer.concat([box('ftyp', Buffer.from('isom0000')), box('moov', Buffer.concat([box('mvhd', mvhd), box('trak', Buffer.concat([box('tkhd', tkhd), box('mdia', box('hdlr', hdlr))]))])), box('mdat', Buffer.from('sample'))])
}
test('MP4 validates duration on server, including a longer track', () => {
  assert.equal(mp4Duration(mp4(30)), 30)
  assert.throws(() => mp4Duration(mp4(31)))
  assert.throws(() => mp4Duration(mp4(20, 31)))
  assert.throws(() => mp4Duration(mp4(0)))
  assert.throws(() => mp4Duration(Buffer.from('not a video')))
  assert.throws(() => mp4Duration(mp4(20).subarray(0, 50)))
})
