import { test } from 'node:test'
import assert from 'node:assert/strict'
import { promises as fsp } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { Store } from '../lib/store.ts'
import { reconcileData, sweepExpired } from '../lib/sweeper.ts'
import type { SweepPaths } from '../lib/sweeper.ts'

async function tmpDir(): Promise<string> {
  return fsp.mkdtemp(path.join(os.tmpdir(), 'lanshare-'))
}

function paths(uploadDir: string, retentionMs: number): SweepPaths {
  return { uploadDir, tmpDir: path.join(uploadDir, 'tmp'), retentionMs }
}

test('reconcileData apaga .part, órfãos e entradas sem ficheiro', async (t) => {
  const dir = await tmpDir()
  t.after(() => fsp.rm(dir, { recursive: true, force: true }))
  const uploadDir = path.join(dir, 'files')
  await fsp.mkdir(path.join(uploadDir, 'tmp'), { recursive: true })

  await fsp.writeFile(path.join(uploadDir, 'tmp', 'f_sobra.part'), 'x')
  await fsp.writeFile(path.join(uploadDir, 'ficheiro-orfao'), 'x')
  await fsp.writeFile(path.join(uploadDir, 'f-existe'), 'conteudo')

  const store = new Store(path.join(dir, 'index.json'))
  store.addFile(1000, { fileId: 'f-existe', name: 'mantido', size: 8, mime: 'x' })
  store.addFile(1000, { fileId: 'f-sumo', name: 'sem ficheiro', size: 1, mime: 'x' })
  await store.save()

  const result = await reconcileData(paths(uploadDir, 0), store)

  assert.equal(result.partsRemoved, 1)
  assert.equal(result.orphansRemoved, 1)
  assert.equal(result.messagesRemoved, 1) // entrada "f-sumo" (sem ficheiro)
  assert.ok(!(await fsp.stat(path.join(uploadDir, 'tmp', 'f_sobra.part')).catch(() => null)))
  assert.ok(!(await fsp.stat(path.join(uploadDir, 'ficheiro-orfao')).catch(() => null)))
  assert.equal(await fsp.readFile(path.join(uploadDir, 'f-existe'), 'utf8'), 'conteudo')
  assert.equal(store.size, 1)
  assert.equal(store.getFile('f-existe')?.file.name, 'mantido')
})

test('reconcileData aplica retenção e apaga os ficheiros expirados', async (t) => {
  const dir = await tmpDir()
  t.after(() => fsp.rm(dir, { recursive: true, force: true }))
  const uploadDir = path.join(dir, 'files')
  await fsp.mkdir(path.join(uploadDir, 'tmp'), { recursive: true })

  const now = Date.now()
  const store = new Store(path.join(dir, 'index.json'))
  store.addFile(now - 60_000, { fileId: 'velho', name: 'velho.pdf', size: 1, mime: 'x' })
  store.addFile(now, { fileId: 'novo', name: 'novo.pdf', size: 1, mime: 'x' })
  await fsp.writeFile(path.join(uploadDir, 'velho'), 'a')
  await fsp.writeFile(path.join(uploadDir, 'novo'), 'b')
  await store.save()

  // 30 s de retenção: "velho" (60 s) expira, "novo" fica.
  const result = await reconcileData(paths(uploadDir, 30_000), store)

  assert.equal(result.messagesRemoved, 1)
  assert.deepEqual(result.filesRemoved, ['velho'])
  assert.ok(!(await fsp.stat(path.join(uploadDir, 'velho')).catch(() => null)))
  assert.equal(await fsp.readFile(path.join(uploadDir, 'novo'), 'utf8'), 'b')
  assert.equal(store.size, 1)
})

test('sweepExpired devolve fileIds removidos e persistita o índice', async (t) => {
  const dir = await tmpDir()
  t.after(() => fsp.rm(dir, { recursive: true, force: true }))
  const uploadDir = path.join(dir, 'files')
  await fsp.mkdir(path.join(uploadDir, 'tmp'), { recursive: true })

  const now = Date.now()
  const store = new Store(path.join(dir, 'index.json'))
  store.addFile(now - 60_000, { fileId: 'a1', name: 'a', size: 1, mime: 'x' })
  store.addText(now - 60_000, 'texto velho')
  store.addFile(now, { fileId: 'b1', name: 'b', size: 1, mime: 'x' })
  await fsp.writeFile(path.join(uploadDir, 'a1'), 'a')
  await fsp.writeFile(path.join(uploadDir, 'b1'), 'b')
  await store.save()

  const removed = await sweepExpired(paths(uploadDir, 30_000), store)

  assert.deepEqual(removed, ['a1'])
  assert.ok(!(await fsp.stat(path.join(uploadDir, 'a1')).catch(() => null)))
  assert.ok(await fsp.stat(path.join(uploadDir, 'b1')))

  const reloaded = new Store(path.join(dir, 'index.json'))
  await reloaded.load()
  assert.equal(reloaded.size, 1)
  assert.equal(reloaded.getFile('b1')?.file.name, 'b')
})