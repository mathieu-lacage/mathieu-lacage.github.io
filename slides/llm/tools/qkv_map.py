# /// script
# requires-python = ">=3.10"
# dependencies = ["torch", "transformers"]
# ///
"""One attention head, seen from the last token: what the « Self-Attention
Intuitively » slide needs from the model.

For the head --layer/--head (1-based, as on the slides) and the last token of
the prompt: the attention weight and score (q·k / √d_h) on every token, the
residual stream x entering the layer (after its RMSNorm, as the head reads it,
sampled to --cells numbers per token for the strips), and what each value
vector says once moved back by the head's slice of W_O and unembedded (top
tokens of W_U · norm(W_O v)), for every value and for their weighted sum.

q and k are taken after QK-norm and RoPE; the softmax recomputed from them is
checked against the model's own attention.

usage: uv run tools/qkv_map.py [--model Qwen/Qwen3-1.7B] [--prompt ...] [--layer 21 --head 13]
output: data/qkv-<name>.json
"""
import argparse
import json
import os

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from transformers.models.qwen3.modeling_qwen3 import apply_rotary_pos_emb


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--model', default='Qwen/Qwen3-1.7B')
    ap.add_argument('--prompt', default='The city of Paris is the capital of')
    ap.add_argument('--layer', type=int, default=21)
    ap.add_argument('--head', type=int, default=13)
    ap.add_argument('--cells', type=int, default=96, help='numbers kept per x strip')
    ap.add_argument('--top', type=int, default=10, help='unembedded tokens kept per value')
    ap.add_argument('--out', default=os.path.join(os.path.dirname(__file__), '..', 'data'))
    args = ap.parse_args()

    tok = AutoTokenizer.from_pretrained(args.model)
    model = AutoModelForCausalLM.from_pretrained(args.model, dtype=torch.float32,
                                                 attn_implementation='eager').eval()
    cfg = model.config
    nH, nKV, dh = cfg.num_attention_heads, cfg.num_key_value_heads, cfg.head_dim
    L, H = args.layer - 1, args.head - 1
    kv = H // (nH // nKV)

    ids = tok(args.prompt, return_tensors='pt').input_ids
    T = ids.shape[1]
    with torch.no_grad():
        out = model(ids, output_hidden_states=True, output_attentions=True)
        layer = model.model.layers[L]
        at = layer.self_attn
        x = layer.input_layernorm(out.hidden_states[L][0])
        q = at.q_norm(at.q_proj(x).view(T, nH, dh))
        k = at.k_norm(at.k_proj(x).view(T, nKV, dh))
        v = at.v_proj(x).view(T, nKV, dh)[:, kv]
        cos, sin = model.model.rotary_emb(x[None], torch.arange(T)[None])
        q, k = apply_rotary_pos_emb(q.transpose(0, 1)[None], k.transpose(0, 1)[None], cos, sin)
        q, k = q[0, H, -1], k[0, kv]
        score = (k @ q) / dh ** .5
        a = score.softmax(-1)
        ref = out.attentions[L][0, H, -1]
        assert torch.allclose(a, ref, atol=1e-4), (a, ref)

        o = v @ at.o_proj.weight[:, H * dh:(H + 1) * dh].T                # T x d: each value, back in x space
        z = (a[:, None] * o).sum(0)

        def top(vec):
            logits = model.lm_head(model.model.norm(vec))
            return [tok.decode([i]) for i in logits.topk(args.top).indices.tolist()]

        step = x.shape[1] // args.cells
        name = args.model.split('/')[-1]
        res = dict(model=args.model, prompt=args.prompt, layer=args.layer, head=args.head, head_dim=dh,
                   tokens=[tok.decode([i]) for i in ids[0]],
                   weight=a.tolist(), score=score.tolist(),
                   x=[[round(t, 4) for t in r[::step][:args.cells]] for r in x.tolist()],
                   value_norm=v.norm(dim=-1).tolist(),
                   value_top=[top(r) for r in o], sum_top=top(z))
    os.makedirs(args.out, exist_ok=True)
    path = os.path.join(args.out, f'qkv-{name}.json')
    with open(path, 'w') as f:
        json.dump(res, f, ensure_ascii=False, indent=1)
    print(f'wrote {path}')
    for t, w_, s, vt in zip(res['tokens'], res['weight'], res['score'], res['value_top']):
        print(f'{t!r:12} weight {w_:.3f} score {s:5.2f}  value: {vt[:5]}')
    print('sum:', res['sum_top'][:5])


if __name__ == '__main__':
    main()
