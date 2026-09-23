import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeDisplayName, contentDisposition, safeMimeType } from '../lib/sanitize.ts'

test('sanitizeDisplayName preserva acentos e espaços', () => {
  assert.equal(sanitizeDisplayName('Relatório final (v2).pdf'), 'Relatório final (v2).pdf')
})

test('sanitizeDisplayName remove separadores de caminho e controlos', () => {
  assert.equal(sanitizeDisplayName('a/b\\c:d.txt'), 'a_b_c_d.txt')
  assert.equal(sanitizeDisplayName('bom\u0000dia.txt'), 'bomdia.txt')
})

test('sanitizeDisplayName com solucoes vazias devolve "ficheiro"', () => {
  assert.equal(sanitizeDisplayName('   '), 'ficheiro')
  assert.equal(sanitizeDisplayName(''), 'ficheiro')
})

test('sanitizeDisplayName trunca preservando a extensão', () => {
  const result = sanitizeDisplayName('a'.repeat(300) + '.pdf')
  assert.ok(result.length <= 200)
  assert.ok(result.endsWith('.pdf'))
})

test('contentDisposition usa fallback ASCII e filename* UTF-8', () => {
  const cd = contentDisposition('Relatório final (v2).pdf', false)
  assert.ok(cd.startsWith('attachment; filename="'), cd)
  assert.ok(cd.includes("filename*=UTF-8''Relat%C3%B3rio%20final%20%28v2%29.pdf"), cd)
})

test('contentDisposition inline para preview', () => {
  const cd = contentDisposition('foto.png', true)
  assert.ok(cd.startsWith('inline; filename="foto.png"'), cd)
})

test('safeMimeType só aceita tipos simples', () => {
  assert.equal(safeMimeType('image/png'), 'image/png')
  assert.equal(safeMimeType('text/plain'), 'text/plain')
  assert.equal(safeMimeType('x\r\ny'), 'application/octet-stream')
  assert.equal(safeMimeType('text/html; charset=utf-8'), 'application/octet-stream')
})