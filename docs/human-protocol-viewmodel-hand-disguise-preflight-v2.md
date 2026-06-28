# Human Protocol Viewmodel Hand Disguise Preflight V2

This C++ preflight reuses the previous WGPU robot hand morphology research and adds Parfit-gated human-disguise constraints before Blender generation.

- Backend: `cpp17-fast-morphology-search`
- Formula: `human-disguise-hand-v2-parfit-gated-from-wgpu-v8`
- Asset: `human-protocol-viewmodel-hand-sidearm-v2`
- Seed: `20260603`
- Candidate count: 20000000
- Variant families: 20000
- Elapsed seconds: 6.881
- Status counts: pass=1611, review=12369, fail=19986020
- Recommended stable best: `sidearm-morph-candidate-15951690` / variant `11690 p0_f9_c4_s4_g1` / `pass` / score 86.829
- Single highest-score candidate: `sidearm-morph-candidate-06751590` / variant `11590 p0_f9_c3_s4_g1` / score 88.325
- Best metrics: fingerDiameterPalmRatio=0.4540, meanFingerBase=0.1731, meanFingerTip=0.1346, shellContinuity=1.1535, fingerOrder=0.9756, contactConstraint=0.9521, thumbOpposition=0.9745, cuteThickness=0.9363, fiveFingerSilhouette=0.9318, visualComplexity=1.0000, stubbyFinger=0.9368, palmGripContact=0.9705, rootAttachment=0.9629, palmHandleCover=0.9080, palmVisibleCamera=0.6076, fingerProjectedShare=0.3924, palmGripDepth=0.9323, minRootGap=1.0000, wrapArc=0.8642, boxPalmPenalty=0.0000

## C++ Summary

- Verdict: use the best stable variant, not only the single lucky candidate.
- Main change: this v2 keeps the old WGPU hand morphology formula but tightens the visible failure cases: the palm must be visible, root-attached, non-boxy, and covering the sidearm grip before Blender is allowed.
- Full-score policy: candidates lose points for distance from ideal targets, so a mathematical 100 should be rare.
- Ranking: mean score + pass rate + best score - score variance.
- Next gate: measure the approved `sidearm-pistol.glb`, then regenerate Blender and visually reject if the palm shell and finger chain still do not read as one human-disguised hand.

## Top Variant Families

- `11690 p0_f9_c4_s4_g1` stability=55.934 passRate=0.03000 mean=71.238 stddev=8.223 best=86.829
- `12490 p0_f9_c4_s5_g1` stability=55.083 passRate=0.02800 mean=70.193 stddev=8.414 best=86.528
- `13290 p0_f9_c4_s6_g1` stability=55.054 passRate=0.02000 mean=70.031 stddev=7.944 best=86.466
- `10990 p0_f9_c5_s3_g1` stability=54.971 passRate=0.00300 mean=70.168 stddev=7.045 best=84.866
- `10890 p0_f9_c4_s3_g1` stability=54.547 passRate=0.01800 mean=70.036 stddev=8.731 best=86.282
- `10190 p0_f9_c5_s2_g1` stability=54.529 passRate=0.00400 mean=69.673 stddev=7.501 best=85.387
- `10191 p1_f9_c5_s2_g1` stability=54.466 passRate=0.01900 mean=69.342 stddev=8.022 best=85.932
- `11790 p0_f9_c5_s4_g1` stability=54.408 passRate=0.01200 mean=69.501 stddev=7.342 best=83.841
- `9390 p0_f9_c5_s1_g1` stability=54.349 passRate=0.01100 mean=69.825 stddev=7.762 best=83.803
- `9391 p1_f9_c5_s1_g1` stability=54.066 passRate=0.00900 mean=69.162 stddev=8.049 best=85.634
- `10980 p0_f8_c5_s3_g1` stability=54.061 passRate=0.00100 mean=69.152 stddev=7.393 best=84.615
- `12480 p0_f8_c4_s5_g1` stability=54.039 passRate=0.02100 mean=69.213 stddev=8.531 best=85.319
- `12590 p0_f9_c5_s5_g1` stability=53.995 passRate=0.00500 mean=68.663 stddev=7.066 best=84.449
- `8591 p1_f9_c5_s0_g1` stability=53.872 passRate=0.01000 mean=69.299 stddev=7.906 best=83.525
- `14090 p0_f9_c4_s7_g1` stability=53.866 passRate=0.01600 mean=68.813 stddev=8.245 best=85.467
- `11691 p1_f9_c4_s4_g1` stability=53.856 passRate=0.01500 mean=68.612 stddev=8.542 best=87.135

## Top Candidates

- `sidearm-morph-candidate-06751590` variant=`11590 p0_f9_c3_s4_g1` score=88.325 status=`pass` issues=none
- `sidearm-morph-candidate-08152391` variant=`12391 p1_f9_c3_s5_g1` score=88.293 status=`pass` issues=none
- `sidearm-morph-candidate-11112291` variant=`12291 p1_f9_c2_s5_g1` score=88.252 status=`pass` issues=none
- `sidearm-morph-candidate-12032381` variant=`12381 p1_f8_c3_s5_g1` score=88.200 status=`pass` issues=none
- `sidearm-morph-candidate-15170790` variant=`10790 p0_f9_c3_s3_g1` score=88.073 status=`review` issues=finger_only_silhouette_too_dominant
- `sidearm-morph-candidate-05271580` variant=`11580 p0_f8_c3_s4_g1` score=87.985 status=`review` issues=finger_roots_not_mathematically_attached_to_palm, finger_only_silhouette_too_dominant
- `sidearm-morph-candidate-02171591` variant=`11591 p1_f9_c3_s4_g1` score=87.884 status=`review` issues=finger_only_silhouette_too_dominant
- `sidearm-morph-candidate-19053171` variant=`13171 p1_f7_c3_s6_g1` score=87.727 status=`pass` issues=none
- `sidearm-morph-candidate-15010690` variant=`10690 p0_f9_c2_s3_g1` score=87.710 status=`review` issues=palm_shell_not_covering_sidearm_grip, finger_only_silhouette_too_dominant
- `sidearm-morph-candidate-15088391` variant=`8391 p1_f9_c3_s0_g1` score=87.692 status=`pass` issues=none

## Direction Winners

| Direction | Winner | Score | Direction score | Palm | Cover | Root | Finger share | Issues |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Human Silicone | `sidearm-morph-candidate-13789192` / `p2_f9_c3_s1_g1` | 86.938 | 73.52 | 0.604 | 0.916 | 0.977 | 0.396 | none |
| Stubby Robot Disguise | `sidearm-morph-candidate-19430880` / `p0_f8_c4_s3_g1` | 85.636 | 93.82 | 0.601 | 0.905 | 0.955 | 0.399 | none |
| Palm Grip Cover | `sidearm-morph-candidate-09451691` / `p1_f9_c4_s4_g1` | 82.631 | 101.35 | 0.605 | 0.958 | 0.966 | 0.395 | none |
| Root Continuity | `sidearm-morph-candidate-13789192` / `p2_f9_c3_s1_g1` | 86.938 | 88.30 | 0.604 | 0.916 | 0.977 | 0.396 | none |
| Thumb Opposition | `sidearm-morph-candidate-15293280` / `p0_f8_c4_s6_g1` | 83.616 | 97.23 | 0.609 | 0.917 | 0.957 | 0.391 | none |
| Low Risk Balanced | `sidearm-morph-candidate-09532490` / `p0_f9_c4_s5_g1` | 84.297 | 51.77 | 0.618 | 0.928 | 0.967 | 0.382 | none |

## Next Gate

Apply the best stable parameters only after real sidearm GLB measurement. Render first-person, palm, back-hand, side, top, reload, rod-hold, and rod-attack views before accepting.
