# Human Protocol Hand Grip Geometry Search V1

This is the first high-sample math pass for the simulated humanoid robot hand.
It tests whether one hand can physically grip both a compact charging pistol and a one-hand baton before Blender asset generation.

## Run

- Generated at: 2026-06-03T14:11:52.532Z
- Families: 20000
- Candidates per family per case: 250
- Total candidates across four cases: 20,000,000
- Accepted candidates: 1,300,159
- C++ elapsed: 70781 ms
- JSON report: ../src/assets/manifests/reports/human_protocol_hand_grip_geometry_v1_report.json
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
| pistol_compact_narrow | 259,963 | 8/8 | 1017.63 | 99.92 | 212.18 | 0.0018 | 0.0005 | 0.1540 | 0.2137 |
| pistol_compact_wide | 239,976 | 8/8 | 1002.91 | 99.69 | 265.84 | 0.0053 | 0.0002 | 0.0953 | 0.2843 |
| baton_slim | 560,872 | 8/8 | 1017.51 | 83.82 | 169.75 | 0.0033 | 0.0004 | 0.1212 | 0.1443 |
| baton_heavy | 239,348 | 8/8 | 1002.81 | 77.06 | 181.07 | 0.0107 | 0.0004 | 0.0799 | 0.1591 |

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
  "family": 12536,
  "index": 119,
  "palmWidth": 0.9432,
  "palmHeight": 1.17,
  "palmDepth": 0.5215,
  "palmOffset": 0.0018,
  "rootGap": 0.0091,
  "fingerRadius": 0.1154,
  "thumbRadius": 0.1323,
  "fingerLength": 0.9219,
  "thumbLength": 0.5824,
  "taper": 0.721,
  "mcp": 1.0488,
  "pip": 1.1293,
  "dip": 0.5843,
  "curlCascade": 0.0672,
  "thumbYaw": 0.5663,
  "thumbCurl": 0.5839,
  "thumbDrop": 0.0838,
  "rootY": 0.3314,
  "spreadScale": 0.6273
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
  "family": 17127,
  "index": 72,
  "palmWidth": 0.9432,
  "palmHeight": 1.2389,
  "palmDepth": 0.5123,
  "palmOffset": 0.0053,
  "rootGap": 0.0136,
  "fingerRadius": 0.1239,
  "thumbRadius": 0.1481,
  "fingerLength": 0.9844,
  "thumbLength": 0.5043,
  "taper": 0.7199,
  "mcp": 0.9723,
  "pip": 1.1686,
  "dip": 0.6088,
  "curlCascade": 0.0465,
  "thumbYaw": 0.791,
  "thumbCurl": 0.6423,
  "thumbDrop": 0.1395,
  "rootY": 0.2869,
  "spreadScale": 0.5966
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
  "family": 12788,
  "index": 105,
  "palmWidth": 1.1108,
  "palmHeight": 1.2582,
  "palmDepth": 0.432,
  "palmOffset": 0.0033,
  "rootGap": 0.0134,
  "fingerRadius": 0.142,
  "thumbRadius": 0.1536,
  "fingerLength": 1.0269,
  "thumbLength": 0.5372,
  "taper": 0.7412,
  "mcp": 1.0859,
  "pip": 1.2896,
  "dip": 0.5291,
  "curlCascade": 0.0078,
  "thumbYaw": 0.6198,
  "thumbCurl": 0.5279,
  "thumbDrop": 0.1788,
  "rootY": 0.3128,
  "spreadScale": 0.5661
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
  "family": 6288,
  "index": 58,
  "palmWidth": 1.0197,
  "palmHeight": 1.1504,
  "palmDepth": 0.4174,
  "palmOffset": -0.0118,
  "rootGap": 0.0011,
  "fingerRadius": 0.1352,
  "thumbRadius": 0.1628,
  "fingerLength": 0.955,
  "thumbLength": 0.4606,
  "taper": 0.7077,
  "mcp": 0.7672,
  "pip": 1.1973,
  "dip": 0.6709,
  "curlCascade": 0.0706,
  "thumbYaw": 0.5717,
  "thumbCurl": 0.8644,
  "thumbDrop": 0.0383,
  "rootY": 0.1631,
  "spreadScale": 0.5909
}
```

## Modeling Handoff

- Use the pistol cases to drive the single-hand sidearm pose.
- Use the baton cases to drive the one-hand rod attack pose.
- Do not accept a Blender hand if the palm support, thumb clamp, and required digit contact gates regress.
- Preserve short, thick silicone fingers with a continuous rounded-square palm shell; avoid bead-like fingertip decoration.

