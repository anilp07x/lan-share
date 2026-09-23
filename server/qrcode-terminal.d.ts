declare module 'qrcode-terminal' {
  interface GenerateOptions {
    small?: boolean
  }

  function generate(input: string, opts?: GenerateOptions): void
  function generate(input: string, cb: (qrcode: string) => void): void
  function generate(input: string, opts: GenerateOptions, cb: (qrcode: string) => void): void

  const qrcodeTerminal: {
    generate: typeof generate
    error: string
  }

  export default qrcodeTerminal
  export { generate }
}