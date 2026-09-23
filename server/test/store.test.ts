import { test } from 'node:test'
import assert from 'node:assert/strict'
import { promises as fsp } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { Store, IndexCorruptError } from '../lib/store.ts'

async function tmpDir(): Promise<string> {
  return fsp.mkdtemp(path.join(os.tmpdir(), 'lanshare-'))
}

test('save/load mantém dados, ordem e mapa de ficheiros', async (t) => {
  const dir = await tmpDir()
  t.after(() => fsp.rm(dir, { recursive: true, force: true }))
  const indexFile = path.join(dir, 'index.json')

  const store = new Store(indexFile)
  const text = store.addText(1000, 'olá')
  const file = store.addFile(2000, { fileId: 'uuid-1', name: 'a.pdf', size: 10, mime: 'application/pdf' })
  assert.equal(store.size, 2)
  await store.save()

  assert.ok(!(await fsp.stat(path.join(dir, 'index.json.tmp')).catch(() => null)), '.tmp não deve sobrar')

  const reloaded = new Store(indexFile)
  await reloaded.load()
  assert.equal(reloaded.size, 2)
  assert.deepEqual(reloaded.recentMessages(10), [text, file])
  assert.equal(reloaded.getFile('uuid-1')?.file.name, 'a.pdf')
})

test('removeMessagesWhere devolve as removidas e reconstrói o mapa', () => {
  const store = new Store('/tmp/nao-usado.json')
  const a = store.addFile(1, { fileId: 'f1', name: 'a', size: 1, mime: 'x' })
  const b = store.addText(2, 'b')
  const c = store.addFile(3, { fileId: 'f2', name: 'c', size: 1, mime: 'x' })
  const removed = store.removeMessagesWhere((m) => m.ts === 2)
  assert.deepEqual(removed, [b])
  assert.equal(store.size, 2)
  assert.equal(store.getFile('f2')?.id, c.id)
  assert.equal(store.getFile('f1')?.id, a.id)
})

test('índice malformado lança IndexCorruptError', async (t) => {
  const dir = await tmpDir()
  t.after(() => fsp.rm(dir, { recursive: true, force: true }))
  const indexFile = path.join(dir, 'index.json')
  await fsp.writeFile(indexFile, '{ json quebrado', 'utf8')

  const store = new Store(indexFile)
  await assert.rejects(() => store.load(), IndexCorruptError)
})

test('índice vazio é aberto sem erros', async (t) => {
  const dir = await tmpDir()
  t.after(() => fsp.rm(dir, { recursive: true, force: true }))
  const store = new Store(path.join(dir, 'index.json'))
  await store.load()
  assert.equal(store.size, 0)
})