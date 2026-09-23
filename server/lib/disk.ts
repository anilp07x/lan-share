import { promises as fsp } from 'node:fs'

/** Bytes livres no diretório (estatística do sistema de ficheiros). */
export async function freeBytes(dir: string): Promise<number> {
  const st = await fsp.statfs(dir)
  const blockSize = typeof st.bsize === 'bigint' ? Number(st.bsize) : st.bsize
  const avail = typeof st.bavail === 'bigint' ? Number(st.bavail) : st.bavail
  return avail * blockSize
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** rename com retry para EPERM (antivírus/Windows). Mesmo volume → atómico em NTFS. */
export async function renameRetry(from: string, to: string, attempts = 4): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await fsp.rename(from, to)
      return
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code === 'EPERM' || code === 'EBUSY') {
        if (attempt < attempts) {
          await sleep(50 * attempt)
          continue
        }
      }
      throw err
    }
  }
}

/** Apaga um ficheiro tolerando erros transitórios; nunca deita abaixo o processo. */
export async function removeQuiet(
  file: string,
  log: (msg: string) => void,
  attempts = 5,
): Promise<boolean> {
  for (let attempt = 1; ; attempt++) {
    try {
      await fsp.rm(file, { force: true })
      return true
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code === 'EPERM' || code === 'EBUSY' || code === 'EACCES') {
        if (attempt < attempts) {
          await sleep(100 * attempt)
          continue
        }
        log(`Não foi possível apagar ${file}: ${(err as Error).message}`)
        return false
      }
      if (code === 'ENOENT') return true
      log(`Erro ao apagar ${file}: ${(err as Error).message}`)
      return false
    }
  }
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}