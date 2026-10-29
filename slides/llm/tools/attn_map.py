# /// script
# requires-python = ">=3.10"
# dependencies = ["torch", "transformers", "matplotlib"]
# ///
"""Where does the last token read from? Two layer x source-token heatmaps.

weight: attention weight of the last token, max over heads (where heads look)
moved:  length of what each head actually brings back from a source token,
        |a_h(s) * v_h(s) W_O^h|, summed over heads (how much is read), plotted
        as each token's share of the layer's total (sizes grow with depth).

The first --skip tokens (default 1: the attention sink) and the last token
itself (self-attention, unless --keep-self) are left out of the plot and of
the shares, which are computed over the remaining positions.

heads:  the raw attention weight of every head (softmax of Q.K at the last
        token), layers x (source token, head), in data/attn-heads-<name>.png.
        Not renormalized: a head parked on the sink shows dark everywhere.

usage: uv run tools/attn_map.py [--model Qwen/Qwen3-1.7B] [--prompt ...]
outputs: data/attn-<name>.json, data/attn-<name>.png, data/attn-heads-<name>.png
"""
import argparse
import json
import os

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--model', default='Qwen/Qwen3-1.7B')
    ap.add_argument('--prompt', default='The city of Paris is the capital of')
    ap.add_argument('--out', default=os.path.join(os.path.dirname(__file__), '..', 'data'))
    ap.add_argument('--skip', type=int, default=1, help='leading tokens left out (attention sink)')
    ap.add_argument('--keep-self', action='store_true', help='keep the last token reading itself')
    ap.add_argument('--name', default=None, help='output basename suffix (default: the model name)')
    args = ap.parse_args()

    dev = 'cuda' if torch.cuda.is_available() else 'cpu'
    tok = AutoTokenizer.from_pretrained(args.model)
    model = AutoModelForCausalLM.from_pretrained(args.model, dtype=torch.float32,
                                                 attn_implementation='eager').to(dev).eval()
    cfg = model.config
    layers = model.model.layers
    nL, nH, nKV = cfg.num_hidden_layers, cfg.num_attention_heads, cfg.num_key_value_heads
    dh = getattr(cfg, 'head_dim', None) or cfg.hidden_size // nH

    ids = tok(args.prompt, return_tensors='pt').input_ids.to(dev)
    toks = [tok.decode([i]) for i in ids[0]]
    T = len(toks)
    vs, hooks = {}, []
    for i, l in enumerate(layers):
        hooks.append(l.self_attn.v_proj.register_forward_hook(
            lambda m, inp, out, i=i: vs.__setitem__(i, out[0].detach())))
    with torch.no_grad():
        out = model(ids, output_attentions=True)
    for h in hooks:
        h.remove()

    weight, moved, heads, per_head_weight = [], [], [], []
    with torch.no_grad():
        for i in range(nL):
            A = out.attentions[i][0, :, -1]                         # nH x T
            v = vs[i].view(T, nKV, dh)
            Wo = layers[i].self_attn.o_proj.weight
            per_head = torch.stack([(Wo[:, h * dh:(h + 1) * dh] @ (A[h, :, None] * v[:, h // (nH // nKV)]).T).norm(dim=0)
                                    for h in range(nH)])               # nH x T
            weight.append(A.max(0).values.tolist())
            per_head_weight.append(A.tolist())
            moved.append(per_head.sum(0).tolist())
            heads.append(per_head.argmax(0).tolist())

    name = args.name or args.model.split('/')[-1]
    os.makedirs(args.out, exist_ok=True)
    base = os.path.join(args.out, f'attn-{name}')
    with open(base + '.json', 'w') as f:
        json.dump(dict(model=args.model, prompt=args.prompt, tokens=toks, n_layers=nL, n_heads=nH,
                       skip=args.skip, keep_self=args.keep_self, weight=weight, moved=moved, top_head=heads,
                       attn=per_head_weight), f, ensure_ascii=False)
    keep = slice(args.skip, None if args.keep_self else -1)
    reader = toks[-1]
    toks, weight, moved = toks[keep], [w[keep] for w in weight], [m[keep] for m in moved]
    share = [[100 * m / sum(row) for m in row] for row in moved]
    print(f'share of what each layer brings back to the last token {reader!r} (%), first '
          f'{args.skip} token(s){"" if args.keep_self else " and the token itself"} left out')
    print('layer' + ''.join(f'{t!r:>11}' for t in toks))
    for i in range(nL):
        print(f'{i + 1:>5}' + ''.join(f'{v:>11.0f}' for v in share[i]))
    plot(toks, reader, weight, share, nL, args, base + '.png')
    head_weights = [[row[keep] for row in layer] for layer in per_head_weight]   # L x H x tokens kept
    plot_heads(toks, reader, head_weights, nL, nH, args,
               os.path.join(args.out, f'attn-heads-{name}.png'))
    print('heads with weight >= 0.5 on a kept token:')
    for i in range(nL):
        hits = [f'h{h}→{toks[s]!r} {head_weights[i][h][s]:.2f}' for h in range(nH)
                for s in range(len(toks)) if head_weights[i][h][s] >= .5]
        if hits:
            print(f'  L{i + 1:>2}: ' + ', '.join(hits))
    print(f'wrote {os.path.relpath(base)}.json, .png and attn-heads-{name}.png')


def plot(toks, reader, weight, share, nL, args, path):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    fig, axs = plt.subplots(1, 2, figsize=(16, 9))
    for ax, data, title in [(axs[0], weight, 'attention weight, max over heads'),
                            (axs[1], share, 'share of what the layer brings back (%): |a · v · W_O|, summed over heads')]:
        im = ax.imshow(data, aspect='auto', cmap='magma', extent=[-.5, len(toks) - .5, nL + .5, .5])
        ax.set_xticks(range(len(toks)), [repr(t) for t in toks], rotation=30)
        ax.set_yticks(range(1, nL + 1))
        ax.set_ylabel('layer')
        ax.set_title(title)
        fig.colorbar(im, ax=ax, shrink=.8)
    left_out = ([f'first {args.skip} token(s)'] if args.skip else []) + ([] if args.keep_self else ['itself'])
    fig.suptitle(f'{args.model} · « {args.prompt} » · reading position: {reader!r} (last)'
                 + (f' · left out: {" and ".join(left_out)}' if left_out else ''))
    fig.tight_layout()
    fig.savefig(path, dpi=110)


def plot_heads(toks, reader, hw, nL, nH, args, path):
    """layers x (token, head): one block of nH thin columns per source token"""
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    n = len(toks)
    grid = [[hw[i][h][s] for s in range(n) for h in range(nH)] for i in range(nL)]
    fig, ax = plt.subplots(figsize=(20, 10))
    im = ax.imshow(grid, aspect='auto', cmap='magma', vmin=0, vmax=1,
                   extent=[-.5, n * nH - .5, nL + .5, .5], interpolation='nearest')
    for s in range(1, n):
        ax.axvline(s * nH - .5, color='white', lw=2)
    ax.set_xticks([s * nH + (nH - 1) / 2 for s in range(n)], [repr(t) for t in toks], fontsize=12)
    ax.set_xticks([s * nH + h for s in range(n) for h in range(0, nH, 4)], minor=True)
    ax.set_xticklabels([str(h) for s in range(n) for h in range(0, nH, 4)], minor=True, fontsize=6)
    ax.tick_params(axis='x', which='major', pad=12)
    ax.set_yticks(range(1, nL + 1))
    ax.set_ylabel('layer')
    ax.set_title(f'{args.model} · « {args.prompt} » · attention weight of {reader!r} (last), '
                 f'per head (thin columns 0..{nH - 1} in each token block)')
    fig.colorbar(im, ax=ax, shrink=.8, label='attention weight')
    fig.tight_layout()
    fig.savefig(path, dpi=110)


if __name__ == '__main__':
    main()
