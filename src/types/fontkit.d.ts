declare module 'fontkit' {
  // Superfície mínima usada no browser (parse de buffer, export NOMEADO — o
  // build browser do fontkit não tem default). Font é tratado como `any`.
  export function create(buffer: Uint8Array, postscriptName?: string): any
}
