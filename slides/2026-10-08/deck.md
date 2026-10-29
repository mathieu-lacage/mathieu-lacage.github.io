---
marp: true
theme: inria
paginate: true
footer: LLM et puissance de calcul — 2026-10-08 — mathieu.lacage@inria.fr
---
<!-- _class: title -->
# LLM et puissance de calcul

De la magie aux FLOPs

<!--
15 minutes. Objectif : donner du contexte sur ce qu'est un LLM,
comment ça marche, et pourquoi tout ceci se traduit en besoins
de calcul très importants.
-->

---
## Parlons de magie

Un phénomène
- qu'on observe
- qu'on ne peut pas expliquer

Montrez une télévision à un humain né en 1500
c'est de la magie

<!--
Télévision, téléphone, scanner, voiture, avion.
Et nous, avec l'IA, on aurait probablement fini sur un bûcher.
-->

---
## Démystifier

Un LLM, c'est une machine qui
- ne pense pas
- n'a pas de conscience
- n'a pas d'objectif

Elle calcule des probabilités. C'est tout.

---
## Inférence et probabilités conditionnelles

<style scoped>
/* Click-driven next-word animation. Each empty .nw-sN marker is a fragment;
   bespoke flags it active/inactive and :has() derives the state from that.
   The default (no bespoke attributes, e.g. the PDF) is the final state, so
   every override below only matches when the attributes are present. */
.nw { display: flex; flex-direction: column; gap: 22px; }
.nw-mark { position: absolute; width: 0; height: 0; }
.nw-prompt {
  font-size: 42px; line-height: 1.3; padding: 14px 24px;
  background: #f3f4f8; border-left: 6px solid var(--inria-blue);
  white-space: nowrap;
}
.nw-new {
  display: inline-block; vertical-align: bottom; overflow: hidden;
  max-width: 6em; color: var(--inria-red-dark); font-weight: bold;
  transition: max-width .6s ease, opacity .6s ease .2s;
}
.nw-cursor { color: var(--inria-slate); margin-left: 4px; animation: nw-blink 1s steps(1) infinite; }
@keyframes nw-blink { 50% { opacity: 0; } }
.nw-dists { display: grid; }
.nw-dist {
  grid-area: 1 / 1; display: grid; row-gap: 6px;
  grid-template-columns: 210px 560px auto; column-gap: 18px; align-items: center;
  font-size: 26px; transition: opacity .5s ease, visibility .5s;
}
.nw-cap { grid-column: 1 / -1; font-size: 22px; color: var(--inria-slate); margin-bottom: 4px; }
.nw-row { display: contents; }
.nw-row > * { transition: opacity .4s ease; }
.nw-w { text-align: right; white-space: nowrap; }
.nw-pct { color: var(--inria-slate); font-variant-numeric: tabular-nums; }
.nw-bar {
  height: 26px; width: calc(var(--p) * 1%); background: var(--inria-blue);
  transform-origin: left; transition: transform .7s ease, background-color .4s ease;
}
.nw-bar.nw-rest { background: repeating-linear-gradient(90deg, #c8ccd8 0 6px, transparent 6px 10px); }
.nw-row:nth-of-type(2) .nw-bar { transition-delay: 0s; }
.nw-row:nth-of-type(3) .nw-bar { transition-delay: .08s; }
.nw-row:nth-of-type(4) .nw-bar { transition-delay: .16s; }
.nw-row:nth-of-type(5) .nw-bar { transition-delay: .24s; }
.nw-row:nth-of-type(6) .nw-bar { transition-delay: .32s; }
.nw-row:nth-of-type(7) .nw-bar { transition-delay: .40s; }

/* final state: both words appended, 2nd distribution shown with "France" picked */
.nw-d1 { opacity: 0; visibility: hidden; }
.nw-d2 .nw-row:not(.nw-pick) > * { opacity: .3; }
.nw-d2 .nw-pick .nw-bar { background: var(--inria-red); }
.nw-d2 .nw-pick .nw-w { color: var(--inria-red-dark); font-weight: bold; }

/* step 1: distribution 1 grows; visible until step 3 */
.nw:has(.nw-s1[data-bespoke-marp-fragment=active]):has(.nw-s3[data-bespoke-marp-fragment=inactive]) .nw-d1 { opacity: 1; visibility: visible; }
.nw:has(.nw-s1[data-bespoke-marp-fragment=inactive]) .nw-d1 .nw-bar { transform: scaleX(0); }
/* step 2: pick "la" */
.nw:has(.nw-s2[data-bespoke-marp-fragment=active]) .nw-d1 .nw-row:not(.nw-pick) > * { opacity: .3; }
.nw:has(.nw-s2[data-bespoke-marp-fragment=active]) .nw-d1 .nw-pick .nw-bar { background: var(--inria-red); }
.nw:has(.nw-s2[data-bespoke-marp-fragment=active]) .nw-d1 .nw-pick .nw-w { color: var(--inria-red-dark); font-weight: bold; }
/* step 3: append "la" */
.nw:has(.nw-s3[data-bespoke-marp-fragment=inactive]) .nw-w1 { max-width: 0; opacity: 0; }
/* step 4: distribution 2 grows */
.nw:has(.nw-s4[data-bespoke-marp-fragment=inactive]) .nw-d2 { opacity: 0; visibility: hidden; }
.nw:has(.nw-s4[data-bespoke-marp-fragment=inactive]) .nw-d2 .nw-bar { transform: scaleX(0); }
/* step 5: pick "France" */
.nw:has(.nw-s5[data-bespoke-marp-fragment=inactive]) .nw-d2 .nw-row > * { opacity: 1; }
.nw:has(.nw-s5[data-bespoke-marp-fragment=inactive]) .nw-d2 .nw-pick .nw-bar { background: var(--inria-blue); }
.nw:has(.nw-s5[data-bespoke-marp-fragment=inactive]) .nw-d2 .nw-pick .nw-w { color: inherit; font-weight: normal; }
/* step 6: append "France" */
.nw:has(.nw-s6[data-bespoke-marp-fragment=inactive]) .nw-w2 { max-width: 0; opacity: 0; }
</style>

<div class="nw">
<i class="nw-mark nw-s1" data-marpit-fragment></i><i class="nw-mark nw-s2" data-marpit-fragment></i><i class="nw-mark nw-s3" data-marpit-fragment></i><i class="nw-mark nw-s4" data-marpit-fragment></i><i class="nw-mark nw-s5" data-marpit-fragment></i><i class="nw-mark nw-s6" data-marpit-fragment></i>
<div class="nw-prompt">Paris est la capitale de<span class="nw-new nw-w1">&nbsp;la</span><span class="nw-new nw-w2">&nbsp;France</span><span class="nw-cursor">▌</span></div>
<div class="nw-dists">
<div class="nw-dist nw-d1">
<div class="nw-cap">Après « Paris est la capitale de », le mot suivant est…</div>
<div class="nw-row nw-pick"><span class="nw-w">la</span><span class="nw-bar" style="--p:38"></span><span class="nw-pct">38 %</span></div>
<div class="nw-row"><span class="nw-w">France</span><span class="nw-bar" style="--p:31"></span><span class="nw-pct">31 %</span></div>
<div class="nw-row"><span class="nw-w">l'</span><span class="nw-bar" style="--p:9"></span><span class="nw-pct">9 %</span></div>
<div class="nw-row"><span class="nw-w">notre</span><span class="nw-bar" style="--p:4"></span><span class="nw-pct">4 %</span></div>
<div class="nw-row"><span class="nw-w">cette</span><span class="nw-bar" style="--p:2"></span><span class="nw-pct">2 %</span></div>
<div class="nw-row"><span class="nw-w">… 99 995 autres</span><span class="nw-bar nw-rest" style="--p:16"></span><span class="nw-pct">16 %</span></div>
</div>
<div class="nw-dist nw-d2">
<div class="nw-cap">Après « Paris est la capitale de la », le mot suivant est…</div>
<div class="nw-row nw-pick"><span class="nw-w">France</span><span class="nw-bar" style="--p:81"></span><span class="nw-pct">81 %</span></div>
<div class="nw-row"><span class="nw-w">région</span><span class="nw-bar" style="--p:6"></span><span class="nw-pct">6 %</span></div>
<div class="nw-row"><span class="nw-w">Belgique</span><span class="nw-bar" style="--p:3"></span><span class="nw-pct">3 %</span></div>
<div class="nw-row"><span class="nw-w">Suisse</span><span class="nw-bar" style="--p:2"></span><span class="nw-pct">2 %</span></div>
<div class="nw-row"><span class="nw-w">Bretagne</span><span class="nw-bar" style="--p:1"></span><span class="nw-pct">1 %</span></div>
<div class="nw-row"><span class="nw-w">… 99 995 autres</span><span class="nw-bar nw-rest" style="--p:7"></span><span class="nw-pct">7 %</span></div>
</div>
</div>
</div>

<!--
Animation pas à pas (6 clics). Les probabilités sont illustratives.

Départ : le modèle reçoit une séquence, « Paris est la capitale de ».
Clic 1 : il calcule la probabilité de chaque mot du vocabulaire (100 000 mots),
**conditionnée** à tous les mots précédents, dans l'ordre exact où ils apparaissent.
Clic 2 : on choisit le plus probable : « la ».
Clic 3 : on l'ajoute à la fin de la séquence.
Clic 4 : et on recommence, avec une séquence plus longue : le contexte a changé,
la distribution aussi. « France » écrase tout.
Clic 5 : on choisit « France ».
Clic 6 : on l'ajoute. Et on recommence, ad nauseam.

Insister sur « conditionnée » : c'est tout le sujet.
Le modèle ne voit qu'une séquence et prédit la suite.
-->

---
## La combinatoire

Avec un vocabulaire de 100 000 mots

- 10 mots : **$10^{50}$** séquences possibles
- 100 mots : **$10^{500}$** séquences possibles

Univers observable : $10^{80}$ atomes

<div data-marpit-fragment>

Le calcul des probabilités de toutes les séquences possibles
est **impossible**

</div>

<!--
L'espace des textes possibles est colossal, et pourtant le modèle
calcule une probabilité pour chaque mot, à chaque étape.
Ces chiffres permettent de prendre la mesure de ce que fait un LLM:
il calcule la probabilité de chaque séquence, parmi toutes les séquences possibles
sur la base des séquences VUES pendant l'entraînement
-->

---
## Le calcul de probabilité

On **approxime** le calcul avec une fonction à N paramètres
dont N<sub>actifs</sub> utilisés pour chaque mot

- N ≈ 1 milliard pour les petits modèles
- N > 2 000 milliards pour les (très) gros modèles

<div data-marpit-fragment>

La complexité
- générer 1 mot: ~2N<sub>actifs</sub> opérations → **inférence**
- apprendre les paramètres: ~6N<sub>actifs</sub> opérations par mot → **entraînement**

</div>

<!--
C'est le pivot de la présentation : les probabilités conditionnelles,
en pratique, c'est une fonction avec énormément de paramètres.
Taille du modèle × nombre de mots = la facture.
notion de parametres actifs.
-->

---
## Héberger le modèle

Il doit rentrer en mémoire GPU (N en paramètres)

| Modèle | Matériel | Acheté | Loué |
|---|---|---|---|
| N < 30 Md | RTX 5090 | 4 k€ | 0,3–0,6 €/h |
| N > 30 Md | RTX Pro 6000 | 15 k€ | 0,9–1,3 €/h |
| N > 1 000 Md | 8×B300 | 0,5–1,4 M€ | 48–80 €/h |

---
## Le prix d'un mot pour Kimi K3

<style>
/* Click-driven flow diagram, same mechanism as the next-word slide: each
   empty .pm-sN marker is a fragment and :has() hides every .pm-kN element
   while step N is inactive. Without bespoke attributes (PDF) all is shown.
   Unscoped: shared with the training slide. */
.pm { position: absolute; left: var(--edge); top: 146px; width: 1152px; height: 500px; }
.pm-mark { position: absolute; width: 0; height: 0; }
.pm-cap {
  position: absolute; font-size: 17px; font-weight: bold; letter-spacing: .08em;
  color: var(--inria-slate); white-space: nowrap;
}
.pm-box {
  position: absolute; width: 190px; height: 70px; box-sizing: border-box;
  padding: 6px 12px; background: #f3f4f8; border-left: 5px solid var(--inria-blue);
  display: flex; flex-direction: column; justify-content: center;
}
.pm-box b { font-size: 26px; line-height: 1.15; white-space: nowrap; }
.pm-box span { font-size: 16px; line-height: 1.2; color: var(--inria-slate); }
.pm-derived { border-left-color: var(--inria-cyan); }
.pm-changed { border-left-color: var(--inria-orange); background: #fff1e3; }
.pm-result { height: 100px; border: 3px solid var(--inria-red); background: #fff; }
.pm-result b { color: var(--inria-red-dark); font-size: 30px; }
.pm-api {
  position: absolute; left: 560px; top: 432px; width: 590px; padding: 10px 16px;
  box-sizing: border-box; border: 2px solid var(--inria-slate); font-size: 22px;
}
.pm-op { position: absolute; font-size: 30px; font-weight: bold; color: var(--inria-slate); }
.pm-arrows { position: absolute; left: 0; top: 0; overflow: visible; }
.pm-arrows path { fill: none; stroke: var(--inria-slate); stroke-width: 2.5; }
.pm-cap, .pm-box, .pm-api, .pm-op, .pm-arrows path { transition: opacity .5s ease, visibility .5s; }
.pm:has(.pm-s1[data-bespoke-marp-fragment=inactive]) .pm-k1,
.pm:has(.pm-s2[data-bespoke-marp-fragment=inactive]) .pm-k2,
.pm:has(.pm-s3[data-bespoke-marp-fragment=inactive]) .pm-k3,
.pm:has(.pm-s4[data-bespoke-marp-fragment=inactive]) .pm-k4,
.pm:has(.pm-s5[data-bespoke-marp-fragment=inactive]) .pm-k5,
.pm:has(.pm-s6[data-bespoke-marp-fragment=inactive]) .pm-k6,
.pm:has(.pm-s7[data-bespoke-marp-fragment=inactive]) .pm-k7,
.pm:has(.pm-s8[data-bespoke-marp-fragment=inactive]) .pm-k8,
.pm:has(.pm-s9[data-bespoke-marp-fragment=inactive]) .pm-k9,
.pm:has(.pm-s10[data-bespoke-marp-fragment=inactive]) .pm-k10,
.pm:has(.pm-s11[data-bespoke-marp-fragment=inactive]) .pm-k11 { opacity: 0; visibility: hidden; }
</style>

<div class="pm">
<i class="pm-mark pm-s1" data-marpit-fragment></i><i class="pm-mark pm-s2" data-marpit-fragment></i><i class="pm-mark pm-s3" data-marpit-fragment></i><i class="pm-mark pm-s4" data-marpit-fragment></i><i class="pm-mark pm-s5" data-marpit-fragment></i><i class="pm-mark pm-s6" data-marpit-fragment></i><i class="pm-mark pm-s7" data-marpit-fragment></i><i class="pm-mark pm-s8" data-marpit-fragment></i><i class="pm-mark pm-s9" data-marpit-fragment></i><i class="pm-mark pm-s10" data-marpit-fragment></i>
<svg class="pm-arrows" width="1152" height="500" viewBox="0 0 1152 500">
<defs><marker id="pm-head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style="fill: var(--inria-slate); stroke: none"/></marker></defs>
<path class="pm-k5" d="M650,167 H690 V221 H716" marker-end="url(#pm-head)"/>
<path class="pm-k5" d="M190,275 H690 V221"/>
<path class="pm-k7" d="M190,59 H1055 V126" marker-end="url(#pm-head)"/>
<path class="pm-k7" d="M910,221 H935 V165 H956" marker-end="url(#pm-head)"/>
<path class="pm-k9" d="M1055,200 V308" marker-end="url(#pm-head)"/>
<path class="pm-k9" d="M190,357 H956" marker-end="url(#pm-head)"/>
</svg>
<div class="pm-cap pm-k6" style="left:0; top:0">UTILISATEURS</div>
<div class="pm-box pm-k6" style="left:0; top:24px"><span>Simultanés</span><b>~200</b></div>
<div class="pm-cap pm-k1" style="left:0; top:108px">MODÈLE · Kimi K3</div>
<div class="pm-box pm-k1" style="left:0; top:132px"><span>Paramètres</span><b>2 800 Md</b></div>
<div class="pm-op pm-k2" style="left:200px; top:144px">×</div>
<div class="pm-box pm-k2" style="left:230px; top:132px"><span>Quantification</span><b>4 bit</b></div>
<div class="pm-op pm-k3" style="left:430px; top:144px">=</div>
<div class="pm-box pm-derived pm-k3" style="left:460px; top:132px"><span>Poids</span><b>1,4 To</b></div>
<div class="pm-cap pm-k4" style="left:0; top:216px">MATÉRIEL · 8×B300</div>
<div class="pm-box pm-k4" style="left:0; top:240px"><span>Mémoire GPU</span><b>64 To/s</b></div>
<div class="pm-box pm-k8" style="left:0; top:322px"><span>Location</span><b>48 €/h</b></div>
<div class="pm-op pm-k5" style="left:652px; top:212px">÷</div>
<div class="pm-box pm-derived pm-k5" style="left:720px; top:186px"><span>Par utilisateur</span><b>45 mots/s</b></div>
<div class="pm-op pm-k7" style="left:1066px; top:70px">×</div>
<div class="pm-box pm-derived pm-k7" style="left:960px; top:130px"><span>Débit total</span><b>9 000 mots/s</b></div>
<div class="pm-box pm-result pm-k9" style="left:960px; top:312px"><span>Prix</span><b>~1,5 €</b><span>par million de mots</span></div>
<div class="pm-api pm-k10">API du marché : <b>0,5 à 20 €</b> par million de mots</div>
</div>

<!--
Animation pas à pas (10 clics).

Clics 1–3 : le modèle. 2 800 milliards de paramètres, stockés sur 4 bits
(un demi-octet) : 1,4 To de poids. En FP8 (2,8 To), il ne tiendrait pas
dans les 8 × 288 Go = 2,3 To des 8×B300.
Clic 4 : le matériel. Ce qui compte n'est pas la puissance de calcul mais
la bande passante mémoire : 8 × 8 To/s ≈ 64 To/s.
Clic 5 : pour produire un mot, il faut relire tous les poids : 64 / 1,4
≈ 45 lectures par seconde, donc ~45 mots/s pour chaque utilisateur.
(Avec un seul utilisateur, seuls les 50 Md de paramètres actifs seraient
lus ; avec 200 utilisateurs en parallèle, presque tous les experts servent.)
Clic 6–7 : une lecture des poids sert tous les utilisateurs du lot :
200 × 45 ≈ 9 000 mots/s. La limite : la mémoire restante (~0,9 To) pour
le contexte de chaque conversation → quelques centaines d'utilisateurs.
Référence : DeepSeek a publié ~15 000 tokens/s par machine de 8 GPU,
~20 tokens/s par utilisateur.
Clic 8–9 : on loue la machine à l'heure, qu'elle travaille ou non :
48 €/h ÷ 32 millions de mots/h ≈ 1,5 € par million de mots.
Seul, le même utilisateur paierait ~300 € par million de mots.
Clic 10 : cohérent avec les prix des API.

Pourquoi pas les FLOPs : 10¹¹ opérations par mot, la machine plafonnerait
vers 400 000 mots/s. On en est loin : c'est la mémoire qui limite.
-->

---
## Entraîner un LLM

<div class="pm">
<i class="pm-mark pm-s1" data-marpit-fragment></i><i class="pm-mark pm-s2" data-marpit-fragment></i><i class="pm-mark pm-s3" data-marpit-fragment></i><i class="pm-mark pm-s4" data-marpit-fragment></i><i class="pm-mark pm-s5" data-marpit-fragment></i><i class="pm-mark pm-s6" data-marpit-fragment></i><i class="pm-mark pm-s7" data-marpit-fragment></i><i class="pm-mark pm-s8" data-marpit-fragment></i><i class="pm-mark pm-s9" data-marpit-fragment></i><i class="pm-mark pm-s10" data-marpit-fragment></i><i class="pm-mark pm-s11" data-marpit-fragment></i>
<svg class="pm-arrows" width="1152" height="500" viewBox="0 0 1152 500">
<defs><marker id="pm-head9" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style="fill: var(--inria-slate); stroke: none"/></marker></defs>
<path class="pm-k8" d="M880,59 H1055 V126" marker-end="url(#pm-head9)"/>
<path class="pm-k8" d="M650,167 H956" marker-end="url(#pm-head9)"/>
<path class="pm-k10" d="M1055,200 V308" marker-end="url(#pm-head9)"/>
<path class="pm-k10" d="M190,357 H956" marker-end="url(#pm-head9)"/>
</svg>
<div class="pm-cap pm-k1" style="left:0; top:0">MODÈLE · Kimi K3 · 2 800 Md paramètres</div>
<div class="pm-box pm-k1" style="left:0; top:24px"><span>Paramètres actifs</span><b>50 Md</b></div>
<div class="pm-op pm-k2" style="left:200px; top:36px">×</div>
<div class="pm-box pm-k2" style="left:230px; top:24px"><span>Mots</span><b>16 000 Md</b></div>
<div class="pm-op pm-k3" style="left:430px; top:36px">×</div>
<div class="pm-box pm-k3" style="left:460px; top:24px"><span>Op. par mot·param.</span><b>6</b></div>
<div class="pm-op pm-k4" style="left:660px; top:36px">=</div>
<div class="pm-box pm-derived pm-k4" style="left:690px; top:24px"><span>Calcul</span><b>5·10²⁴ op.</b></div>
<div class="pm-cap pm-k5" style="left:0; top:108px">MATÉRIEL · 1×B300 · FP8</div>
<div class="pm-box pm-k5" style="left:0; top:132px"><span>Puissance crête</span><b>5 PFLOPS</b></div>
<div class="pm-op pm-k6" style="left:200px; top:144px">×</div>
<div class="pm-box pm-k6" style="left:230px; top:132px"><span>Utilisation (MFU)</span><b>20 %</b></div>
<div class="pm-op pm-k7" style="left:430px; top:144px">=</div>
<div class="pm-box pm-derived pm-k7" style="left:460px; top:132px"><span>Effective</span><b>1 PFLOPS</b></div>
<div class="pm-op pm-k8" style="left:790px; top:124px">÷</div>
<div class="pm-box pm-derived pm-k8" style="left:960px; top:130px"><span>Durée sur 1 GPU</span><b>150 ans</b></div>
<div class="pm-cap pm-k9" style="left:0; top:298px">LOCATION</div>
<div class="pm-box pm-k9" style="left:0; top:322px"><span>Prix</span><b>6 €/GPU·h</b></div>
<div class="pm-op pm-k10" style="left:560px; top:316px">×</div>
<div class="pm-box pm-result pm-k10" style="left:960px; top:312px"><span>Coût</span><b>~8 M€</b><span>un seul entraînement</span></div>
<div class="pm-api pm-k11" style="left:0; width:900px">Soit 1 000×B300 pendant ~2 mois… et il faut encore payer les développeurs</div>
</div>

<!--
Animation pas à pas (11 clics).

Clics 1–4 : le calcul. Mixture of experts : pour chaque mot, seuls
50 milliards des 2 800 milliards de paramètres sont utilisés. Le coût de
calcul dépend des paramètres actifs ; la mémoire, elle, dépend du total.
Règle classique : ~6 opérations par paramètre actif et par mot
(2 pour la passe avant, 4 pour la rétropropagation).
6 × 50·10⁹ × 16·10¹² ≈ 4,8·10²⁴ ≈ 5·10²⁴ opérations.
(On néglige l'attention : +5 à 20 % selon la longueur de contexte.)

Clics 5–7 : la machine. Un B300 fait ~5 PFLOPS en FP8 sur le papier,
mais on n'atteint jamais la crête : le MFU (model FLOPs utilization)
mesure la fraction réellement utile. Pour un MoE, les échanges entre GPU
(all-to-all) et le déséquilibre entre experts le font chuter :
DeepSeek-V3 a mesuré ~17 % de la crête FP8 de ses H800. On prend 20 %.

Clic 8 : 5·10²⁴ / 10¹⁵ ≈ 4,8·10⁹ s ≈ 150 ans sur un seul GPU,
soit ~1,3 million de GPU·h.

Clics 9–10 : 1,3 M GPU·h × 6 € ≈ 8 M€.

Clic 11 : en pratique, 1 000 B300 pendant ~8 semaines.
C'est le coût d'un seul entraînement réussi : un plancher.
Il faut ajouter les essais ratés, les expériences, les salaires,
et l'accès à un cluster de milliers de GPU.
-->

---
## Entraîner un SLM

<div class="pm">
<svg class="pm-arrows" width="1152" height="500" viewBox="0 0 1152 500">
<defs><marker id="pm-head10" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style="fill: var(--inria-slate); stroke: none"/></marker></defs>
<path d="M880,59 H1055 V126" marker-end="url(#pm-head10)"/>
<path d="M650,167 H956" marker-end="url(#pm-head10)"/>
<path d="M1055,200 V308" marker-end="url(#pm-head10)"/>
<path d="M190,357 H956" marker-end="url(#pm-head10)"/>
</svg>
<div class="pm-cap" style="left:0; top:0">MODÈLE · dense · tous les paramètres actifs</div>
<div class="pm-box pm-changed" style="left:0; top:24px"><span>Paramètres actifs</span><b>1 Md</b></div>
<div class="pm-op" style="left:200px; top:36px">×</div>
<div class="pm-box pm-changed" style="left:230px; top:24px"><span>Mots (2 000 / param.)</span><b>2 000 Md</b></div>
<div class="pm-op" style="left:430px; top:36px">×</div>
<div class="pm-box" style="left:460px; top:24px"><span>Op. par mot·param.</span><b>6</b></div>
<div class="pm-op" style="left:660px; top:36px">=</div>
<div class="pm-box pm-derived" style="left:690px; top:24px"><span>Calcul</span><b>1·10²² op.</b></div>
<div class="pm-cap" style="left:0; top:108px">MATÉRIEL · 1×B300 · FP8</div>
<div class="pm-box" style="left:0; top:132px"><span>Puissance crête</span><b>5 PFLOPS</b></div>
<div class="pm-op" style="left:200px; top:144px">×</div>
<div class="pm-box pm-changed" style="left:230px; top:132px"><span>Utilisation (MFU)</span><b>40 %</b></div>
<div class="pm-op" style="left:430px; top:144px">=</div>
<div class="pm-box pm-derived" style="left:460px; top:132px"><span>Effective</span><b>2 PFLOPS</b></div>
<div class="pm-op" style="left:790px; top:124px">÷</div>
<div class="pm-box pm-derived" style="left:960px; top:130px"><span>Durée sur 1 GPU</span><b>70 jours</b></div>
<div class="pm-cap" style="left:0; top:298px">LOCATION</div>
<div class="pm-box" style="left:0; top:322px"><span>Prix</span><b>6 €/GPU·h</b></div>
<div class="pm-op" style="left:560px; top:316px">×</div>
<div class="pm-box pm-result" style="left:960px; top:312px"><span>Coût</span><b>~10 k€</b><span>un seul entraînement</span></div>
<div class="pm-api" style="left:0; top:412px; width:900px">Soit 8 B300 pendant ~10 jours : à la portée de beaucoup d'entreprises et de labos.<br>Important pour l'adaptation de vocabulaire</div>
</div>

<!--
Même calcul que pour Kimi K3, en orange ce qui change.

Modèle dense de 1 milliard de paramètres : tous actifs.
~2 000 mots par paramètre (bien au-delà de l'optimum « Chinchilla »
de ~20, mais un petit modèle gagne à être sur-entraîné) :
2 000 milliards de mots. 6 × 10⁹ × 2·10¹² ≈ 1,2·10²² opérations,
400 fois moins que K3.

MFU 40 % : un modèle dense n'a pas les échanges entre GPU d'un MoE,
il exploite bien mieux la machine.
1,2·10²² / 2·10¹⁵ = 6·10⁶ s ≈ 70 jours ≈ 1 700 GPU·h ≈ 10 k€.

Qui a besoin d'un modèle capable
- de lire du chinois
- et de générer un rapport financier
- et de déboguer du COBOL ?

Le vrai enjeu : comprendre ses données,
son domaine — juridique, médical...
Entraîner soi-même permet d'adapter le vocabulaire (tokenizer) au domaine.
-->

---
## SLM: notre sujet de recherche

Comment entraîner ces petits modèles efficacement ?

Dans quelles conditions le résultat correspond-il
aux besoins réels ?

> Un petit modèle entraîné sur vos données peut-il
> concurrencer un gros modèle généraliste ?

Financé par l'ANR (FATEs-MLOps et PROFIL),
en collaboration avec UniCA et le CNRS

---
## Fine-tuner un modèle

<div class="pm">
<svg class="pm-arrows" width="1152" height="500" viewBox="0 0 1152 500">
<defs><marker id="pm-head12" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style="fill: var(--inria-slate); stroke: none"/></marker></defs>
<path d="M880,59 H1055 V126" marker-end="url(#pm-head12)"/>
<path d="M650,167 H956" marker-end="url(#pm-head12)"/>
<path d="M1055,200 V308" marker-end="url(#pm-head12)"/>
<path d="M190,357 H956" marker-end="url(#pm-head12)"/>
</svg>
<div class="pm-cap" style="left:0; top:0">MODÈLE EXISTANT · dense · tous les paramètres actifs</div>
<div class="pm-box pm-changed" style="left:0; top:24px"><span>Paramètres actifs</span><b>30 Md</b></div>
<div class="pm-op" style="left:200px; top:36px">×</div>
<div class="pm-box pm-changed" style="left:230px; top:24px"><span>Mots du corpus</span><b>1,5 Md</b></div>
<div class="pm-op" style="left:430px; top:36px">×</div>
<div class="pm-box" style="left:460px; top:24px"><span>Op. par mot·param.</span><b>6</b></div>
<div class="pm-op" style="left:660px; top:36px">=</div>
<div class="pm-box pm-derived" style="left:690px; top:24px"><span>Calcul</span><b>3·10²⁰ op.</b></div>
<div class="pm-cap" style="left:0; top:108px">MATÉRIEL · 1×B300 · FP8</div>
<div class="pm-box" style="left:0; top:132px"><span>Puissance crête</span><b>5 PFLOPS</b></div>
<div class="pm-op" style="left:200px; top:144px">×</div>
<div class="pm-box" style="left:230px; top:132px"><span>Utilisation (MFU)</span><b>40 %</b></div>
<div class="pm-op" style="left:430px; top:144px">=</div>
<div class="pm-box pm-derived" style="left:460px; top:132px"><span>Effective</span><b>2 PFLOPS</b></div>
<div class="pm-op" style="left:790px; top:124px">÷</div>
<div class="pm-box pm-derived" style="left:960px; top:130px"><span>Durée sur 1 GPU</span><b>~37 h</b></div>
<div class="pm-cap" style="left:0; top:298px">LOCATION</div>
<div class="pm-box" style="left:0; top:322px"><span>Prix</span><b>6 €/GPU·h</b></div>
<div class="pm-op" style="left:560px; top:316px">×</div>
<div class="pm-box pm-result" style="left:960px; top:312px"><span>Coût</span><b>~200 €</b><span>un fine-tuning</span></div>
<div class="pm-api" style="left:0; width:900px">Soit 8 B300 pendant ~4 h : partir d'un modèle existant, l'adapter à un corpus</div>
</div>

<!--
Même calcul, en orange ce qui change par rapport au SLM.

On part d'un modèle déjà entraîné (30 milliards de paramètres, dense)
et on continue l'entraînement sur son propre corpus : ~1,5 milliard de mots,
mille fois moins qu'un entraînement complet.
6 × 30·10⁹ × 1,5·10⁹ ≈ 2,7·10²⁰ opérations.
MFU 40 % comme pour le SLM : modèle dense.
2,7·10²⁰ / 2·10¹⁵ ≈ 1,35·10⁵ s ≈ 37 h ≈ 225 €, soit 200 à 300 €.

Le coût suit le nombre de mots : c'est l'entraînement initial qui coûte cher,
l'adaptation est presque gratuite.
-->

---
## Combien coûte la magie

| Usage | Coût |
|---|---|
| Inférence | 0,5–20 € par million de mots |
| Entraîner un LLM | ~8 M€ (un seul run) |
| Entraîner un SLM | 10 k€ |
| Fine-tuner un LLM | ~200 € |

<!--
La slide à retenir. Un seul entraînement d'un modèle frontière, c'est
« seulement » quelques M€ de calcul. Le vrai verrou est ailleurs :
les essais ratés, les données, une équipe de ~80 personnes pendant
plusieurs années, et l'accès à un cluster de milliers de GPU.
Un petit modèle, c'est la version sur laquelle un labo peut itérer.
-->

---
<!-- _class: title -->
<!-- _paginate: false -->
# Questions ?

Pas de magie.
Uniquement des probabilités conditionnelles
