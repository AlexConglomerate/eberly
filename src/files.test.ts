// Юнит-тесты файлового ядра: toBlob / toMultipartFormData / mimeFromName —
// чистые функции, без сети. Путь к файлу проверяем через временный файл.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mimeFromName, toBlob, toMultipartFormData } from './files'

const bytes = (n: number) => new Uint8Array([n])

test('mimeFromName: mime по расширению, регистр не важен', () => {
  assert.equal(mimeFromName('a.jpg'), 'image/jpeg')
  assert.equal(mimeFromName('/x/y/b.PNG'), 'image/png')
  assert.equal(mimeFromName('doc.pdf'), 'application/pdf')
  assert.equal(mimeFromName('noext'), 'application/octet-stream')
})

test('toBlob: { content, name } → File с mime по имени', async () => {
  const blob = await toBlob({ content: bytes(1), name: 'p.png' })
  assert.ok(blob instanceof Blob)
  assert.equal((blob as File).name, 'p.png')
  assert.equal(blob.type, 'image/png')
  assert.equal(blob.size, 1)
})

test('toBlob: готовый File/Blob возвращается как есть', async () => {
  const f = new File([bytes(1)], 'x.bin', { type: 'x/y' })
  assert.equal(await toBlob(f), f)
})

test('toBlob: строка-путь читается с диска, имя/mime выводятся', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ebely-files-'))
  const path = join(dir, 'hi.txt')
  await writeFile(path, 'hello')
  try {
    const blob = await toBlob(path)
    assert.equal((blob as File).name, 'hi.txt')
    assert.equal(blob.type, 'text/plain')
    assert.equal(await blob.text(), 'hello')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('toBlob: file://-URL читается с диска', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ebely-files-'))
  const path = join(dir, 'pic.jpg')
  await writeFile(path, 'jpegbytes')
  try {
    const url = new URL(`file://${path}`)
    const blob = await toBlob(url)
    assert.equal((blob as File).name, 'pic.jpg')
    assert.equal(blob.type, 'image/jpeg')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

const twoFiles = [
  { content: bytes(1), name: 'a.jpg' },
  { content: bytes(2), name: 'b.jpg' },
]

test("toMultipartFormData: encoding 'repeat' → files, files", async () => {
  const form = await toMultipartFormData({
    body: { files: twoFiles },
    fileFields: [{ name: 'files', array: true }],
    encoding: 'repeat',
  })
  assert.deepEqual([...form.keys()], ['files', 'files'])
})

test("toMultipartFormData: encoding 'bracket-index' → files[0], files[1]", async () => {
  const form = await toMultipartFormData({
    body: { files: twoFiles },
    fileFields: [{ name: 'files', array: true }],
    encoding: 'bracket-index',
  })
  assert.deepEqual([...form.keys()], ['files[0]', 'files[1]'])
})

test("toMultipartFormData: encoding 'bracket-empty' → files[], files[]", async () => {
  const form = await toMultipartFormData({
    body: { files: twoFiles },
    fileFields: [{ name: 'files', array: true }],
    encoding: 'bracket-empty',
  })
  assert.deepEqual([...form.keys()], ['files[]', 'files[]'])
})

test('toMultipartFormData: кастомная функция-кодировщик', async () => {
  const form = await toMultipartFormData({
    body: { files: twoFiles },
    fileFields: [{ name: 'files', array: true }],
    encoding: ({ form, field, blobs }) => {
      blobs.forEach((b, i) => form.append(`${field}-${i}`, b))
    },
  })
  assert.deepEqual([...form.keys()], ['files-0', 'files-1'])
})

test('toMultipartFormData: одиночный файл (array:false) — поле без скобок', async () => {
  const form = await toMultipartFormData({
    body: { avatar: { content: bytes(1), name: 'a.png' } },
    fileFields: [{ name: 'avatar', array: false }],
    // кодировка для одного файла игнорируется
    encoding: 'bracket-index',
  })
  assert.deepEqual([...form.keys()], ['avatar'])
  assert.ok(form.get('avatar') instanceof Blob)
})

test('toMultipartFormData: смешанное тело — скаляры строками, объект через JSON', async () => {
  const form = await toMultipartFormData({
    body: {
      files: [{ content: bytes(1), name: 'a.jpg' }],
      title: 'hi',
      count: 3,
      meta: { a: 1 },
    },
    fileFields: [{ name: 'files', array: true }],
    encoding: 'repeat',
  })
  assert.equal(form.get('title'), 'hi')
  assert.equal(form.get('count'), '3')
  assert.equal(form.get('meta'), JSON.stringify({ a: 1 }))
  assert.ok(form.get('files') instanceof Blob)
})
