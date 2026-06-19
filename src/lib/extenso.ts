const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove']
const DEZ_A_DEZENOVE = ['dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']

function extensoGrupo(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'cem'
  const partes: string[] = []
  const centena = Math.floor(n / 100)
  const resto = n % 100
  if (centena > 0) partes.push(CENTENAS[centena])
  if (resto > 0) {
    if (resto < 10) partes.push(UNIDADES[resto])
    else if (resto < 20) partes.push(DEZ_A_DEZENOVE[resto - 10])
    else {
      const d = Math.floor(resto / 10)
      const u = resto % 10
      partes.push(u === 0 ? DEZENAS[d] : `${DEZENAS[d]} e ${UNIDADES[u]}`)
    }
  }
  return partes.join(' e ')
}

function extensoInteiro(n: number): string {
  if (n === 0) return 'zero'
  const grupos: number[] = []
  let resto = n
  while (resto > 0) {
    grupos.push(resto % 1000)
    resto = Math.floor(resto / 1000)
  }

  const partes: string[] = []
  for (let i = grupos.length - 1; i >= 0; i--) {
    const g = grupos[i]
    if (g === 0) continue
    if (i === 0) {
      partes.push(extensoGrupo(g))
    } else if (i === 1) {
      partes.push(g === 1 ? 'mil' : `${extensoGrupo(g)} mil`)
    } else if (i === 2) {
      partes.push(g === 1 ? 'um milhão' : `${extensoGrupo(g)} milhões`)
    } else {
      partes.push(g === 1 ? 'um bilhão' : `${extensoGrupo(g)} bilhões`)
    }
  }
  return partes.join(' e ')
}

export function valorPorExtenso(valor: number): string {
  const reais = Math.floor(Math.abs(valor))
  const centavos = Math.round((Math.abs(valor) - reais) * 100)

  const reaisTexto = `${extensoInteiro(reais)} ${reais === 1 ? 'real' : 'reais'}`
  if (centavos === 0) return reaisTexto

  const centavosTexto = `${extensoInteiro(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`
  return `${reaisTexto} e ${centavosTexto}`
}
