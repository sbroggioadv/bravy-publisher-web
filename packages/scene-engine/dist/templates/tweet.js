import { nid, slidePrefix } from '../ids.js';
import { headlineRuns, parseInline } from '../text/runs.js';
import { fitBlock, layoutBlock } from '../text/layout.js';
const W = 1080;
const H = 1080;
const PAD = 76;
const CX = PAD;
const CW = W - 2 * PAD; // 928
const AVATAR = 104;
function st(tokens, role, weight, size, fill, o = {}) {
    const f = tokens.font(role, weight);
    return {
        family: f.family,
        weight: f.weight,
        italic: o.italic ?? f.italic,
        size,
        fill: tokens.color(fill),
        letterSpacingEm: o.ls ?? 0,
        lineHeight: o.lh ?? 1.2,
    };
}
function spec(runs, width, styleOf, align) {
    return { runs, width, styleOf, align };
}
/** aplica o override de tipografia do container ANTES do layout (reflow real). */
function typed(ctx, containerId, styleOf) {
    const t = ctx.typo?.(containerId);
    if (!t)
        return styleOf;
    return (k) => {
        const s = styleOf(k);
        return { ...s, family: t.family ?? s.family, weight: t.weight ?? s.weight, italic: t.family ? false : s.italic };
    };
}
function pushBlock(nodes, prefix, path, block, x, y, z) {
    let li = 0;
    for (const line of block.lines) {
        let ri = 0;
        for (const r of line.runs) {
            nodes.push({
                type: 'glyphrun',
                id: nid(prefix, `${path}.l${li}r${ri}`),
                container: nid(prefix, path),
                z,
                x: x + r.x,
                baselineY: y + r.baselineY,
                text: r.text,
                style: r.style,
            });
            ri++;
        }
        li++;
    }
    return block.height;
}
// ---- nome / @handle derivados do brand kit (display name à parte chega depois) ----
function displayName(handle) {
    return handle.replace(/^@/, '');
}
function atHandle(handle) {
    const h = handle.replace(/^@/, '');
    return `@${h.toLowerCase()}`;
}
// ---- estilos de texto do card ----
function leadStyleOf(tokens, size, lh = 1.24) {
    return (k) => {
        switch (k) {
            case 'strong': return st(tokens, 'display', 700, size, 'accent', { ls: -0.01, lh });
            case 'em': return st(tokens, 'accent', 400, size, 'accent', { italic: true, lh });
            case 'code':
            case 'keyword': return st(tokens, 'mono', 500, size * 0.9, 'accent', { lh });
            default: return st(tokens, 'display', 700, size, 'ink', { ls: -0.01, lh });
        }
    };
}
function bodyStyleOf(tokens, size) {
    return (k) => {
        switch (k) {
            case 'strong': return st(tokens, 'body', 700, size, 'ink', { lh: 1.38 });
            case 'em': return st(tokens, 'accent', 400, size, 'accent', { italic: true, lh: 1.38 });
            case 'code':
            case 'keyword': return st(tokens, 'mono', 500, size * 0.92, 'accent', { lh: 1.38 });
            default: return st(tokens, 'body', 400, size, 'inkSoft', { lh: 1.38 });
        }
    };
}
/** Cabeçalho do card: avatar + nome + @handle + contador (page/total). */
function header(nodes, ctx, prefix, page, total) {
    const { tokens, metrics } = ctx;
    const ay = PAD;
    // avatar: foto de perfil do canal conectado quando houver; senão, placeholder
    // circular com o glifo da marca. ImageNode com radius = AVATAR/2 → círculo.
    const avatarUrl = tokens.brand.avatarUrl;
    if (avatarUrl) {
        nodes.push({ type: 'image', id: nid(prefix, 'avatar'), z: 6, frame: { x: CX, y: ay, w: AVATAR, h: AVATAR }, src: avatarUrl, fit: 'cover', radius: AVATAR / 2 });
    }
    else {
        nodes.push({ type: 'ellipse', id: nid(prefix, 'avatar'), z: 6, frame: { x: CX, y: ay, w: AVATAR, h: AVATAR }, fill: tokens.color('accentSoft') });
        const glyph = st(tokens, 'accent', 400, AVATAR * 0.5, 'bg', { lh: 1 });
        const gm = metrics.measure(tokens.brand.logoGlyph, glyph);
        nodes.push({ type: 'glyphrun', id: nid(prefix, 'avatar.glyph'), z: 7, x: CX + AVATAR / 2 - gm.width / 2, baselineY: ay + AVATAR / 2 + gm.ascent / 2 - gm.descent / 2, text: tokens.brand.logoGlyph, style: glyph });
    }
    const tx = CX + AVATAR + 28;
    const nameStyle = st(tokens, 'display', 800, 38, 'ink', { ls: -0.01 });
    const nm = metrics.measure(displayName(tokens.brand.handle), nameStyle);
    const nameBaseline = ay + 44;
    nodes.push({ type: 'glyphrun', id: nid(prefix, 'name'), z: 10, x: tx, baselineY: nameBaseline, text: displayName(tokens.brand.handle), style: nameStyle });
    void nm;
    const handleStyle = st(tokens, 'body', 400, 30, 'muted');
    nodes.push({ type: 'glyphrun', id: nid(prefix, 'handle'), z: 10, x: tx, baselineY: nameBaseline + 42, text: atHandle(tokens.brand.handle), style: handleStyle });
    // contador 1/8 no topo-direita, alinhado ao nome
    if (ctx.settings?.showCounter !== false) {
        const countStyle = st(tokens, 'mono', 600, 32, 'accent', { ls: 0.02 });
        const counter = `${page}/${total}`;
        const cw = metrics.measure(counter, countStyle).width;
        nodes.push({ type: 'glyphrun', id: nid(prefix, 'counter'), z: 10, x: W - PAD - cw, baselineY: nameBaseline, text: counter, style: countStyle });
    }
    return ay + AVATAR; // bottom do header
}
/** Faixa de imagem arredondada na base do card (só existe quando o slide tem asset). */
function imageBand(nodes, prefix, src) {
    const h = 392;
    const y = H - PAD - h;
    nodes.push({ type: 'image', id: nid(prefix, 'image'), z: 4, frame: { x: CX, y, w: CW, h }, src, fit: 'cover', radius: 24 });
    return y; // topo da faixa
}
const LEAD_GAP = 34;
const PARA_GAP = 22;
const BODY_SIZE = 40;
/**
 * Empilha lead + parágrafos CONTIDOS em [top, bottom]. Duas passadas:
 * mede tudo (parágrafo que estoura o espaço restante é encolhido/elipsado
 * via fitBlock; os seguintes são descartados), depois emite com o offset
 * de alinhamento vertical.
 */
function textBlock(nodes, ctx, prefix, leadRuns, paragraphs, top, bottom, opts) {
    const { metrics } = ctx;
    const avail = bottom - top;
    const placed = [];
    let cursor = 0;
    if (leadRuns.some((r) => r.text.trim())) {
        const styleOf = typed(ctx, nid(prefix, 'lead'), leadStyleOf(ctx.tokens, opts.leadSize, opts.leadLh));
        const lb = fitBlock(spec(leadRuns, CW, styleOf), metrics, Math.min(opts.leadMaxH, avail), opts.leadFloor);
        placed.push({ path: 'lead', block: lb, y: cursor });
        cursor += lb.height;
    }
    const minParaH = BODY_SIZE * 1.38; // ~1 linha de corpo: menos que isso, descarta
    const styleOf = bodyStyleOf(ctx.tokens, BODY_SIZE);
    paragraphs.forEach((runs, i) => {
        if (!runs.some((r) => r.text.trim()))
            return;
        const gap = placed.length === 0 ? 0 : placed[placed.length - 1].path === 'lead' ? LEAD_GAP : PARA_GAP;
        const remaining = avail - cursor - gap;
        if (remaining < minParaH)
            return;
        const sp = spec(runs, CW, typed(ctx, nid(prefix, `para[${i}]`), styleOf));
        let b = layoutBlock(sp, metrics);
        if (b.height > remaining)
            b = fitBlock(sp, metrics, remaining, 0.85);
        placed.push({ path: `para[${i}]`, block: b, y: cursor + gap });
        cursor += gap + b.height;
    });
    const base = top + (opts.valign === 'center' ? Math.max(0, (avail - cursor) / 2) : 0);
    for (const p of placed)
        pushBlock(nodes, prefix, p.path, p.block, CX, base + p.y, 10);
}
/** Converte o corpo do slide (list/paragraphs/stats/cards) em parágrafos de tweet. */
function paragraphsFrom(slide) {
    if (slide.list)
        return slide.list.map((i) => parseInline(i));
    if (slide.paragraphs)
        return slide.paragraphs.map((p) => parseInline(p));
    if (slide.stats)
        return slide.stats.map(([n, t]) => [{ text: `${n} `, key: 'em' }, ...parseInline(t)]);
    if (slide.cards)
        return slide.cards.map((c) => [{ text: `${c.title ?? ''} `, key: 'strong' }, ...parseInline(c.body ?? '')]);
    return [];
}
// ---------------- COVER ----------------
function buildCover(content, total, ctx) {
    const { tokens } = ctx;
    const prefix = slidePrefix('cover', 0);
    const nodes = [];
    const headerBottom = header(nodes, ctx, prefix, 1, total);
    const lead = parseInline(content.hookCapa);
    const paras = [];
    if (content.labelCapa)
        paras.push(parseInline(content.labelCapa));
    textBlock(nodes, ctx, prefix, lead, paras, headerBottom + 56, H - PAD, {
        leadSize: 72, leadMaxH: 560, leadFloor: 0.7, leadLh: 1.16, valign: 'center',
    });
    return { role: 'cover', sourceIndex: 0, background: tokens.color('bg'), nodes };
}
// ---------------- BODY ----------------
function buildBody(slide, sourceIndex, page, total, ctx) {
    const { tokens } = ctx;
    const prefix = slidePrefix('body', sourceIndex);
    const nodes = [];
    const headerBottom = header(nodes, ctx, prefix, page, total);
    // com imagem, o texto para 44px acima da faixa; sem imagem, usa a altura toda
    const src = slide.image?.assetUrl;
    const bandTop = src ? imageBand(nodes, prefix, src) : undefined;
    const bottom = bandTop !== undefined ? bandTop - 44 : H - PAD;
    const lead = slide.headlineTop || slide.headlineEm || slide.headlineBottom
        ? headlineRuns(slide.headlineTop, slide.headlineEm, slide.headlineBottom)
        : slide.tag
            ? parseInline(slide.tag)
            : [];
    textBlock(nodes, ctx, prefix, lead, paragraphsFrom(slide), headerBottom + 56, bottom, {
        leadSize: 50, leadMaxH: 240, leadFloor: 0.8, valign: 'top',
    });
    return { role: 'body', sourceIndex, background: tokens.color('bg'), nodes };
}
// ---------------- CTA ----------------
function buildCta(content, total, ctx) {
    const { tokens } = ctx;
    const prefix = slidePrefix('cta', 0);
    const nodes = [];
    const headerBottom = header(nodes, ctx, prefix, total, total);
    const lead = parseInline(content.ctaText || '');
    const paras = [];
    if (content.ctaSub)
        paras.push(parseInline(content.ctaSub));
    textBlock(nodes, ctx, prefix, lead, paras, headerBottom + 56, H - PAD, {
        leadSize: 56, leadMaxH: 360, leadFloor: 0.75, valign: 'center',
    });
    return { role: 'cta', sourceIndex: 0, background: tokens.color('bg'), nodes };
}
export const tweetTemplate = {
    family: 'tweet',
    build(content, ctx) {
        const total = content.slides.length + 2;
        const slides = [];
        slides.push(buildCover(content, total, ctx));
        content.slides.forEach((s, i) => slides.push(buildBody(s, i, i + 2, total, ctx)));
        slides.push(buildCta(content, total, ctx));
        return slides;
    },
};
