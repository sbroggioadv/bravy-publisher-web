/**
 * Content fixo p/ a rota /studio-demo — permite testar o estúdio (seleção,
 * drag/snapping, resize, edição inline, undo/redo, thumbnails) SEM backend.
 * Os saves disparam e falham silenciosamente (catch nos hooks de persist);
 * o export exige backend e mostra toast de erro — esperado em demo.
 */
import type { Content } from '@/types/content'

const SLIDES_DATA = {
  slug: 'demo-pis-cofins-no-sped',
  template: 'step',
  persona: 'contador',
  label_topo_capa: 'CLAUDE CODE BR',
  label_capa: 'O ERRO DE R$ 30 MIL/ANO',
  hook_capa: 'Todo mês some dinheiro no <em>lugar errado</em>',
  slides: [
    {
      tag: 'onde todo mundo escorrega',
      headline_top: 'O cliente',
      headline_em: 'erra',
      headline_bottom: 'e ninguém percebe',
      list: [
        'Crédito de <strong>PIS/COFINS</strong> lançado na conta errada do plano.',
        'O <code>SPED</code> aceita — a malha fina cruza seis meses depois, calada.',
        'A autuação chega com <em>75% de multa</em> mais juros Selic acumulados.',
      ],
    },
    {
      tag: 'o tamanho do rombo',
      headline_top: 'Não é',
      headline_em: 'centavo',
      headline_bottom: 'é o ano inteiro',
      stats: [
        ['R$ 30 mil', 'recuperados num único cliente médio por ano de revisão.'],
        ['6 meses', 'é o atraso típico entre o erro e a notificação da Receita.'],
        ['75%', 'de multa sobre o débito apurado em autuação de ofício.'],
      ],
    },
    {
      tag: 'como blindar',
      headline_top: 'Dois',
      headline_em: 'checks',
      headline_bottom: 'antes de transmitir',
      cards: [
        { label: 'ANTES', icon: '①', title: 'Concilia o crédito', body: 'Cruza o razão com o bloco <em>M</em> do SPED Contribuições.', highlight: false },
        { label: 'DEPOIS', icon: '②', title: 'Valida a apuração', body: 'Confere CST e base antes do <code>fechamento</code>.', highlight: true },
      ],
    },
  ],
  cta_label_topo: 'tá na hora',
  cta_label: 'leva 2 minutos pra colar',
  cta_text: 'Comenta <span class="keyword">hoje</span> e te mando o <em>checklist</em>',
  cta_sub: 'Sem te cobrar nada.',
  caption: 'Salva esse post pra revisar antes do próximo SPED.',
} as const

const N = SLIDES_DATA.slides.length // 3 body → 5 slides de cena

export const DEMO_CONTENT: Content = {
  id: 'demo',
  slug: SLIDES_DATA.slug,
  status: 'DRAFT',
  contentType: 'CAROUSEL',
  persona: 'contador',
  pattern: 'A',
  templateSlug: 'step',
  labelTopoCapa: SLIDES_DATA.label_topo_capa,
  labelCapa: SLIDES_DATA.label_capa,
  hookCapa: SLIDES_DATA.hook_capa,
  slides: Array.from({ length: N + 2 }, (_, position) => ({
    id: `demo-slide-${position}`,
    position,
    labelTopo: '',
  })),
  ctaLabelTopo: SLIDES_DATA.cta_label_topo,
  ctaLabel: SLIDES_DATA.cta_label,
  ctaText: SLIDES_DATA.cta_text,
  ctaSub: SLIDES_DATA.cta_sub,
  caption: SLIDES_DATA.caption,
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
  authorId: 'demo',
  publishTargets: [],
  slidesData: SLIDES_DATA as unknown as Record<string, unknown>,
}
