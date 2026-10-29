# /// script
# requires-python = ">=3.10"
# dependencies = ["torch", "transformers"]
# ///
"""Naive auto-regressive decoding, pass after pass: what the « Decoding repeats
itself » slide needs from the model.

Greedy decoding from --prompt, --passes passes, each one rerunning the model on
the whole sequence (no cache), in fp32 on the CPU so that the passes can be
compared to the bit. For every pass and every row: the token and its id, the
first --cells numbers of x (the embedding), h_1 (after block 1) and h_L (the last
hidden state), the largest score and its token. Also the largest difference,
over every number of every hidden state, between the rows a pass shares with
the pass before it: 0.0 when the rows are computed again identically.

usage: uv run tools/kv_passes.py [--model Qwen/Qwen3-1.7B] [--prompt ...] [--passes 3]
output: themes/kvpasses.js (window.KV_PASSES = {...}), read by themes/kvcache.js;
a script rather than JSON, so that the deck also works from file://
"""
import argparse
import json
import os

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--model', default='Qwen/Qwen3-1.7B')
    ap.add_argument('--prompt', default='Paris is the capital')
    ap.add_argument('--passes', type=int, default=3)
    ap.add_argument('--cells', type=int, default=3, help='numbers kept per row')
    ap.add_argument('--out', default=os.path.join(os.path.dirname(__file__), '..', 'themes', 'kvpasses.js'))
    args = ap.parse_args()

    tok = AutoTokenizer.from_pretrained(args.model)
    model = AutoModelForCausalLM.from_pretrained(args.model, dtype=torch.float32).eval()
    ids = tok(args.prompt, return_tensors='pt').input_ids
    r2 = lambda m: [[round(v, 2) for v in row] for row in m[:, :args.cells].tolist()]

    passes, prev = [], None
    for _ in range(args.passes):
        with torch.no_grad():
            out = model(ids, output_hidden_states=True)
        hs = torch.stack(out.hidden_states)[:, 0]          # (L + 1, n, d)
        logits = out.logits[0]
        n = ids.shape[1]
        p = {
            'tok': [tok.decode([t]) for t in ids[0]], 'ids': ids[0].tolist(),
            'x': r2(hs[0]), 'h1': r2(hs[1]), 'hL': r2(hs[-1]),
            'top': [round(v, 2) for v in logits.max(-1).values.tolist()],
            'pred': [tok.decode([t]) for t in logits.argmax(-1)],
            'diff': None if prev is None else (hs[:, :n - 1] - prev).abs().max().item(),
        }
        passes.append(p)
        print(f"n = {n}: {''.join(p['tok'])!r} → {p['pred'][-1]!r}, largest difference with the previous pass: {p['diff']}")
        prev = hs
        ids = torch.cat([ids, logits[-1].argmax().view(1, 1)], 1)

    with open(args.out, 'w') as f:
        f.write(f'// by tools/kv_passes.py: {args.model}, fp32, « {args.prompt} », {args.passes} greedy passes without cache\n')
        f.write('window.KV_PASSES = ' + json.dumps(passes, ensure_ascii=False) + ';\n')


if __name__ == '__main__':
    main()
