import { promises as fsp } from 'node:fs'
import crypto from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import forge from 'node-forge'

/**
 * Certificados próprios para HTTPS na rede local.
 *
 * Uma autoridade (CA) gerada na primeira execução assina o certificado do
 * servidor. Cada dispositivo instala a CA uma vez; daí em diante o servidor
 * pode renovar o seu certificado (novo IP, validade) sem nada mudar do lado
 * dos telemóveis. A chave da CA nunca sai deste computador.
 */

export interface TlsMaterial {
  key: string
  cert: string
  caCert: string
  /** IPs incluídos no certificado do servidor. */
  ips: string[]
  hostname: string
}

const CA_YEARS = 10
// O iOS recusa certificados de servidor com mais de 825 dias; 397 cumpre tudo.
const LEAF_DAYS = 397
const RENEW_BEFORE_DAYS = 30

/** IPv4 de rede local deste computador (mesma lista que os URLs mostrados). */
export function localIps(): string[] {
  const out = new Set<string>()
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs ?? []) if (a.family === 'IPv4' && !a.internal) out.add(a.address)
  }
  return [...out].sort()
}

function rsaKeyPair(): { privateKey: forge.pki.rsa.PrivateKey; publicKey: forge.pki.rsa.PublicKey } {
  // o gerador nativo do Node é muito mais rápido do que o do forge (JS puro)
  const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  })
  const key = forge.pki.privateKeyFromPem(privateKey) as forge.pki.rsa.PrivateKey
  return { privateKey: key, publicKey: forge.pki.rsa.setPublicKey(key.n, key.e) }
}

function serial(): string {
  // positivo (primeiro bit a 0) e aleatório, como pede o RFC 5280
  const bytes = crypto.randomBytes(16)
  bytes[0]! &= 0x7f
  return bytes.toString('hex')
}

function createCa(): { key: string; cert: string } {
  const { privateKey, publicKey } = rsaKeyPair()
  const cert = forge.pki.createCertificate()
  cert.publicKey = publicKey
  cert.serialNumber = serial()
  cert.validity.notBefore = new Date(Date.now() - 60_000)
  cert.validity.notAfter = new Date()
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + CA_YEARS)
  const subject = [
    { name: 'commonName', value: `LAN Share CA (${os.hostname()})` },
    { name: 'organizationName', value: 'LAN Share' },
  ]
  cert.setSubject(subject)
  cert.setIssuer(subject)
  cert.setExtensions([
    { name: 'basicConstraints', cA: true, pathLenConstraint: 0, critical: true },
    { name: 'keyUsage', keyCertSign: true, cRLSign: true, critical: true },
    { name: 'subjectKeyIdentifier' },
  ])
  cert.sign(privateKey, forge.md.sha256.create())
  return { key: forge.pki.privateKeyToPem(privateKey), cert: forge.pki.certificateToPem(cert) }
}

function createLeaf(ca: { key: string; cert: string }, hostname: string, ips: string[]): { key: string; cert: string } {
  const caCert = forge.pki.certificateFromPem(ca.cert)
  const caKey = forge.pki.privateKeyFromPem(ca.key)
  const { privateKey, publicKey } = rsaKeyPair()
  const cert = forge.pki.createCertificate()
  cert.publicKey = publicKey
  cert.serialNumber = serial()
  cert.validity.notBefore = new Date(Date.now() - 60_000)
  cert.validity.notAfter = new Date(Date.now() + LEAF_DAYS * 86_400_000)
  cert.setSubject([{ name: 'commonName', value: hostname }])
  cert.setIssuer(caCert.subject.attributes)
  cert.setExtensions([
    { name: 'basicConstraints', cA: false, critical: true },
    { name: 'keyUsage', digitalSignature: true, keyEncipherment: true, critical: true },
    { name: 'extKeyUsage', serverAuth: true },
    {
      name: 'subjectAltName',
      altNames: [
        { type: 2, value: hostname },
        { type: 2, value: 'localhost' },
        { type: 7, ip: '127.0.0.1' },
        ...ips.map((ip) => ({ type: 7, ip })),
      ],
    },
    { name: 'subjectKeyIdentifier' },
    { name: 'authorityKeyIdentifier', keyIdentifier: caCert.generateSubjectKeyIdentifier().getBytes() },
  ])
  cert.sign(caKey, forge.md.sha256.create())
  return { key: forge.pki.privateKeyToPem(privateKey), cert: forge.pki.certificateToPem(cert) }
}

/** O certificado atual serve? (validade e todos os IPs atuais incluídos) */
function leafStillGood(certPem: string, hostname: string, ips: string[]): boolean {
  try {
    const x509 = new crypto.X509Certificate(certPem)
    if (Date.parse(x509.validTo) - Date.now() < RENEW_BEFORE_DAYS * 86_400_000) return false
    const san = x509.subjectAltName ?? ''
    return san.includes(`DNS:${hostname}`) && ips.every((ip) => san.includes(`IP Address:${ip}`))
  } catch {
    return false
  }
}

async function readIfExists(file: string): Promise<string | null> {
  try {
    return await fsp.readFile(file, 'utf8')
  } catch {
    return null
  }
}

async function writePrivate(file: string, data: string): Promise<void> {
  await fsp.writeFile(file, data, { encoding: 'utf8', mode: 0o600 })
}

/**
 * Lê (ou cria) a CA e um certificado de servidor válido para os IPs atuais.
 * `hostname` é o nome .local anunciado por mDNS (ex.: "lanshare.local").
 */
export async function ensureTls(dir: string, hostname: string, ips: string[] = localIps()): Promise<TlsMaterial> {
  await fsp.mkdir(dir, { recursive: true })
  const files = {
    caKey: path.join(dir, 'ca.key'),
    caCert: path.join(dir, 'ca.crt'),
    key: path.join(dir, 'server.key'),
    cert: path.join(dir, 'server.crt'),
  }

  let caKey = await readIfExists(files.caKey)
  let caCert = await readIfExists(files.caCert)
  if (!caKey || !caCert) {
    const ca = createCa()
    caKey = ca.key
    caCert = ca.cert
    await writePrivate(files.caKey, caKey)
    await fsp.writeFile(files.caCert, caCert, 'utf8')
  }

  let key = await readIfExists(files.key)
  let cert = await readIfExists(files.cert)
  if (!key || !cert || !leafStillGood(cert, hostname, ips)) {
    const leaf = createLeaf({ key: caKey, cert: caCert }, hostname, ips)
    key = leaf.key
    cert = leaf.cert
    await writePrivate(files.key, key)
    await fsp.writeFile(files.cert, cert, 'utf8')
  }

  return { key, cert, caCert, ips, hostname }
}
