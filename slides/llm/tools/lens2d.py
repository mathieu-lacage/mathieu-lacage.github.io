# /// script
# requires-python = ">=3.10"
# dependencies = ["torch", "transformers", "matplotlib"]
# ///
"""Logit lens, seen as a 2-D trajectory.

Runs a causal LM on a prompt and, after every attention and every FFN
sub-block, unembeds the residual stream of the LAST position (final norm,
then W_U). For each of these steps it records the score of the target
token and the score of its best competitor, then plots

    x = score of the best competitor,  y = score of the target

one point per layer output, as probabilities on log axes: softmax ignores a
shift common to all scores, and raw scores drift a lot from layer to layer.
Above the diagonal y = x, the target beats that competitor. A second panel
shows the margin (target score - competitor score) per layer. The data files
also hold the steps after each attention sub-block and the embedding.

usage: uv run tools/lens2d.py [--model gpt2-medium] [--prompt ...] [--target ...]
outputs: <out>/<name>.json (all the numbers), <out>/<name>.csv, <out>/<name>.png
"""
import argparse
import csv
import json
import os

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer


def parts(model):
    """(blocks, attention modules, final norm) for the usual HF layouts."""
    if hasattr(model, 'transformer') and hasattr(model.transformer, 'h'):  # GPT-2
        blocks = model.transformer.h
        return blocks, [b.attn for b in blocks], model.transformer.ln_f
    if hasattr(model, 'model') and hasattr(model.model, 'layers'):  # Llama, Qwen, Mistral...
        blocks = model.model.layers
        return blocks, [b.self_attn for b in blocks], model.model.norm
    raise SystemExit(f'unsupported architecture: {type(model).__name__}')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--model', default='gpt2-medium')
    ap.add_argument('--prompt', default='Paris is the capital of')
    ap.add_argument('--target', default=' France', help='next token to track (mind the leading space)')
    ap.add_argument('--vs', default=None, help='fixed competitor token instead of the best other one')
    ap.add_argument('--top', type=int, default=5, help='top-k tokens recorded per step')
    ap.add_argument('--out', default=os.path.join(os.path.dirname(__file__), '..', 'data'))
    ap.add_argument('--name', default=None, help='output basename (default: derived from the model)')
    args = ap.parse_args()

    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    tok = AutoTokenizer.from_pretrained(args.model)
    model = AutoModelForCausalLM.from_pretrained(args.model, dtype=torch.float32).to(device).eval()
    blocks, attns, norm = parts(model)
    W_U = model.get_output_embeddings()

    def one_token(s):
        ids = tok.encode(s, add_special_tokens=False)
        if len(ids) != 1:
            raise SystemExit(f'{s!r} is {len(ids)} tokens {[tok.decode([i]) for i in ids]}: pick a single-token target')
        return ids[0]

    target = one_token(args.target)
    vs = one_token(args.vs) if args.vs else None

    # residual stream entering each block, and each attention output, at the last position
    block_in, attn_out = {}, {}
    hooks = []
    for i, (b, a) in enumerate(zip(blocks, attns)):
        hooks.append(b.register_forward_pre_hook(
            lambda m, inp, kw, i=i: block_in.__setitem__(i, (inp[0] if inp else kw['hidden_states'])[0, -1].detach()),
            with_kwargs=True))
        hooks.append(a.register_forward_hook(lambda m, inp, out, i=i: attn_out.__setitem__(i, out[0][0, -1].detach())))

    enc = tok(args.prompt, return_tensors='pt').to(device)
    with torch.no_grad():
        out = model(**enc, output_hidden_states=True)
    for h in hooks:
        h.remove()
    n_layers = len(blocks)
    final = out.hidden_states[-1][0, -1]  # HF already applied the final norm to this one

    # residual stream after each sub-block: emb, then attn/ffn of every layer
    steps = [('embed', 0, block_in[0])]
    for i in range(n_layers):
        mid = block_in[i] + attn_out[i]
        nxt = block_in[i + 1] if i + 1 < n_layers else None
        steps.append(('attn', i + 1, mid))
        steps.append(('ffn', i + 1, nxt))

    rows = []
    with torch.no_grad():
        for kind, layer, h in steps:
            hn = final if h is None else norm(h)
            logits = W_U(hn).float()
            logp = torch.log_softmax(logits, -1)
            probs = logp.exp()
            t_score = logits[target].item()
            others = logits.clone()
            others[target] = -float('inf')
            comp = vs if vs is not None else int(others.argmax())
            topv, topi = logits.topk(args.top)
            rows.append({
                'step': len(rows), 'layer': layer, 'kind': kind,
                'target_score': t_score, 'target_prob': probs[target].item(), 'target_logp': logp[target].item(),
                'target_rank': int((logits > t_score).sum()) + 1, 'target_id': target,
                'competitor': tok.decode([comp]), 'competitor_id': comp, 'competitor_score': logits[comp].item(),
                'competitor_logp': logp[comp].item(), 'competitor_prob': probs[comp].item(),
                'margin': t_score - logits[comp].item(),
                'top': [(tok.decode([int(i)]), v.item(), probs[i].item()) for v, i in zip(topv, topi)],
                'residual_norm': (final if h is None else h).norm().item(),
            })

    # sanity check: the last step must match the model's own prediction
    assert torch.allclose(W_U(final).float(), out.logits[0, -1].float(), atol=1e-3)

    name = args.name or args.model.split('/')[-1]
    os.makedirs(args.out, exist_ok=True)
    base = os.path.join(args.out, name)
    with open(base + '.json', 'w') as f:
        json.dump({'model': args.model, 'prompt': args.prompt, 'target': args.target,
                   'vs': args.vs, 'n_layers': n_layers, 'vocab': W_U.weight.shape[0], 'steps': rows}, f, indent=1, ensure_ascii=False)
    with open(base + '.csv', 'w', newline='') as f:
        w = csv.writer(f)
        w.writerow(['step', 'layer', 'kind', 'target_score', 'target_prob', 'target_rank',
                    'competitor', 'competitor_score', 'margin', 'top1', 'top1_prob'])
        for r in rows:
            w.writerow([r['step'], r['layer'], r['kind'], f"{r['target_score']:.3f}", f"{r['target_prob']:.4f}",
                        r['target_rank'], r['competitor'], f"{r['competitor_score']:.3f}", f"{r['margin']:.3f}",
                        r['top'][0][0], f"{r['top'][0][2]:.4f}"])
    plot(rows, args, n_layers, base + '.png')

    print(f'{args.model}: {n_layers} layers, prompt {args.prompt!r}, target {args.target!r}')
    print(f'{"step":>8} {"rank":>6} {"p":>7} {"margin":>8}  competitor     top-1')
    for r in rows:
        lab = 'embed' if r['kind'] == 'embed' else f"L{r['layer']}.{r['kind']}"
        print(f"{lab:>8} {r['target_rank']:>6} {r['target_prob']:7.4f} {r['margin']:8.2f}  "
              f"{r['competitor']!r:<14} {r['top'][0][0]!r}")
    print(f'wrote {os.path.relpath(base)}.json, .csv, .png')


def plot(rows, args, n_layers, path):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    import matplotlib.ticker

    # one point per layer: the residual stream at the output of each block
    rows = [r for r in rows if r['kind'] == 'ffn']
    layers = [r['layer'] for r in rows]
    comp = repr(args.vs.strip()) if args.vs else 'the best other token'
    target = repr(args.target.strip())
    fig, (ax, sx, bx) = plt.subplots(1, 3, figsize=(24, 8), gridspec_kw={'width_ratios': [1, 1, 1.2]})
    fig.suptitle(f'{args.model} · « {args.prompt} » → {target}')

    def trajectory(ax, x, y, lo, hi, colorbar=False):
        """Path of the layer outputs, with the y = x decision boundary."""
        ax.plot([lo, hi], [lo, hi], color='0.6', ls='--', lw=1)
        ax.fill_between([lo, hi], [lo, hi], hi, color='tab:green', alpha=.06)
        ax.plot(x, y, color='0.75', lw=1, zorder=1)
        sc = ax.scatter(x, y, c=layers, cmap='viridis', s=30, zorder=2)
        if colorbar:
            fig.colorbar(sc, ax=ax, label='layer', shrink=.8)
        for a, b, l in zip(x, y, layers):
            ax.annotate(str(l), (a, b), textcoords='offset points', xytext=(5, -3), fontsize=8)
        ax.set_xlim(lo, hi)
        ax.set_ylim(lo, hi)
        ax.set_aspect('equal')

    # probabilities, log axes
    x = [r['competitor_prob'] for r in rows]
    y = [r['target_prob'] for r in rows]
    lo = min(x + y) / 2
    ax.set_xscale('log')
    ax.set_yscale('log')
    trajectory(ax, x, y, lo, 1)
    ax.text(lo * 1.5, .7, f'{args.target.strip()} wins', color='tab:green', va='top')
    pct = matplotlib.ticker.FuncFormatter(lambda v, _: f'{v * 100:g} %')
    ax.xaxis.set_major_formatter(pct)
    ax.yaxis.set_major_formatter(pct)
    ax.set_xlabel(f'p of {comp}')
    ax.set_ylabel(f'p of {target}')
    ax.set_title('probabilities')

    # raw scores (logits), linear axes
    x = [r['competitor_score'] for r in rows]
    y = [r['target_score'] for r in rows]
    lo, hi = min(x + y), max(x + y)
    pad = (hi - lo) * .05
    trajectory(sx, x, y, lo - pad, hi + pad, colorbar=True)
    sx.text(lo, hi, f'{args.target.strip()} wins', color='tab:green', va='top')
    sx.set_xlabel(f'score of {comp}')
    sx.set_ylabel(f'score of {target}')
    sx.set_title('scores: h · row of W_U')

    # margin at the output of each layer
    m = [r['margin'] for r in rows]
    bx.axhline(0, color='0.6', ls='--', lw=1)
    bx.plot(layers, m, color='0.75', lw=1, zorder=1)
    bx.scatter(layers, m, c=layers, cmap='viridis', s=30, zorder=2)
    for k, r in enumerate(rows):
        if k == 0 or r['competitor'] != rows[k - 1]['competitor']:
            bx.annotate(repr(r['competitor']), (layers[k], m[k]), textcoords='offset points', xytext=(2, 6), fontsize=8)
    bx.set_xticks(layers)
    bx.set_xlabel('layer')
    bx.set_ylabel(f'margin: score of {target} - score of {comp}')
    bx.set_title('above 0: the target is the most likely token')
    fig.tight_layout()
    fig.savefig(path, dpi=150)


if __name__ == '__main__':
    main()
