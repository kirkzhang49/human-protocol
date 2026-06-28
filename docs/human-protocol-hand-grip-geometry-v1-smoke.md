# Human Protocol Hand Grip Geometry Search V1

This is the first high-sample math pass for the simulated humanoid robot hand.
It tests whether one hand can physically grip both a compact charging pistol and a one-hand baton before Blender asset generation.

## Run

- Generated at: 2026-06-03T14:10:26.452Z
- Families: 800
- Candidates per family per case: 320
- Total candidates across four cases: 1,024,000
- Accepted candidates: 66,412
- C++ elapsed: 3586 ms
- JSON report: ../src/assets/manifests/reports/human_protocol_hand_grip_geometry_v1_smoke_report.json
- Reference image: ../../agents/visual-asset-agent/generated/human-protocol/sim-hand-pistol-rod-multiview-v1.png

## Principle

Hard grip gates run before style score: reject floating fingers, hidden palms, missing thumb clamp, fake contacts, and collision-stop corrections that are too large before aesthetic ranking.

Hard constraints:
- noPenetration
- palmSupport
- requiredDigitContact
- thumbClamp
- handleEnclosure
- contactNormal
- jointFeasible
- rootContinuity

Soft style constraints:
- fingerTaper
- phalanxRatio
- naturalCurlCascade
- palmExposure
- contactSmoothness

## Case Results

| Case | Accepted | Hard Gates | Total | Visual | Coverage | Palm Gap | Thumb Gap | Clamp Line | Stop Correction |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| pistol_compact_narrow | 13,402 | 8/8 | 1013.94 | 98.21 | 257.63 | 0.0010 | 0.0042 | 0.1434 | 0.2279 |
| pistol_compact_wide | 12,265 | 8/8 | 1001.32 | 98.93 | 260.43 | 0.0068 | 0.0005 | 0.1248 | 0.2788 |
| baton_slim | 28,467 | 8/8 | 1012.46 | 85.11 | 171.42 | 0.0008 | 0.0005 | 0.1194 | 0.1720 |
| baton_heavy | 12,278 | 8/8 | 994.85 | 79.13 | 213.47 | 0.0007 | 0.0002 | 0.0981 | 0.2098 |

## Best Parameters

### pistol_compact_narrow

Hard pass map:
- noPenetration: pass
- palmSupport: pass
- requiredDigitContact: pass
- thumbClamp: pass
- handleEnclosure: pass
- contactNormal: pass
- jointFeasible: pass
- rootContinuity: pass

Candidate:

```json
{
  "family": 604,
  "index": 208,
  "palmWidth": 1.0873,
  "palmHeight": 1.1674,
  "palmDepth": 0.4816,
  "palmOffset": -0.001,
  "rootGap": 0.0061,
  "fingerRadius": 0.1362,
  "thumbRadius": 0.1569,
  "fingerLength": 0.9256,
  "thumbLength": 0.5764,
  "taper": 0.7456,
  "mcp": 1.0159,
  "pip": 1.2143,
  "dip": 0.6128,
  "curlCascade": 0.0624,
  "thumbYaw": 0.8932,
  "thumbCurl": 0.7999,
  "thumbDrop": 0.1494,
  "rootY": 0.2857,
  "spreadScale": 0.603
}
```

### pistol_compact_wide

Hard pass map:
- noPenetration: pass
- palmSupport: pass
- requiredDigitContact: pass
- thumbClamp: pass
- handleEnclosure: pass
- contactNormal: pass
- jointFeasible: pass
- rootContinuity: pass

Candidate:

```json
{
  "family": 475,
  "index": 202,
  "palmWidth": 0.9322,
  "palmHeight": 1.1975,
  "palmDepth": 0.5347,
  "palmOffset": 0.0068,
  "rootGap": 0.0128,
  "fingerRadius": 0.1179,
  "thumbRadius": 0.1319,
  "fingerLength": 0.9323,
  "thumbLength": 0.5395,
  "taper": 0.7027,
  "mcp": 0.9164,
  "pip": 1.068,
  "dip": 0.6828,
  "curlCascade": 0.0662,
  "thumbYaw": 0.655,
  "thumbCurl": 0.962,
  "thumbDrop": 0.1074,
  "rootY": 0.3581,
  "spreadScale": 0.517
}
```

### baton_slim

Hard pass map:
- noPenetration: pass
- palmSupport: pass
- requiredDigitContact: pass
- thumbClamp: pass
- handleEnclosure: pass
- contactNormal: pass
- jointFeasible: pass
- rootContinuity: pass

Candidate:

```json
{
  "family": 110,
  "index": 140,
  "palmWidth": 1.0194,
  "palmHeight": 1.1992,
  "palmDepth": 0.4985,
  "palmOffset": 0.0008,
  "rootGap": 0.0077,
  "fingerRadius": 0.1262,
  "thumbRadius": 0.1412,
  "fingerLength": 0.9692,
  "thumbLength": 0.5769,
  "taper": 0.7311,
  "mcp": 1.1037,
  "pip": 1.3341,
  "dip": 0.4589,
  "curlCascade": 0.0546,
  "thumbYaw": 0.6293,
  "thumbCurl": 0.7348,
  "thumbDrop": 0.1162,
  "rootY": 0.2646,
  "spreadScale": 0.6558
}
```

### baton_heavy

Hard pass map:
- noPenetration: pass
- palmSupport: pass
- requiredDigitContact: pass
- thumbClamp: pass
- handleEnclosure: pass
- contactNormal: pass
- jointFeasible: pass
- rootContinuity: pass

Candidate:

```json
{
  "family": 736,
  "index": 240,
  "palmWidth": 1.0125,
  "palmHeight": 1.2432,
  "palmDepth": 0.4267,
  "palmOffset": 0.0007,
  "rootGap": 0.0103,
  "fingerRadius": 0.1236,
  "thumbRadius": 0.1428,
  "fingerLength": 0.9897,
  "thumbLength": 0.549,
  "taper": 0.6978,
  "mcp": 1.0119,
  "pip": 1.5656,
  "dip": 0.683,
  "curlCascade": 0.0875,
  "thumbYaw": 0.962,
  "thumbCurl": 0.5924,
  "thumbDrop": 0.0642,
  "rootY": 0.1628,
  "spreadScale": 0.5963
}
```

## Modeling Handoff

- Use the pistol cases to drive the single-hand sidearm pose.
- Use the baton cases to drive the one-hand rod attack pose.
- Do not accept a Blender hand if the palm support, thumb clamp, and required digit contact gates regress.
- Preserve short, thick silicone fingers with a continuous rounded-square palm shell; avoid bead-like fingertip decoration.

