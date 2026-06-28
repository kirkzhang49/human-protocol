# raw-webgpu PMREM / 环境反射 / 离屏 post 补链路 roadmap

这份文档只回答一个问题：

为什么 Human Museum 在 `renderer=raw-webgpu` 下即使基础光线改善后，仍然容易出现“发灰、发平、缺高级感”的感觉；以及我们能不能把 research 里缺的链路补上。

答案是：可以补，但要分成三层，不能把三个问题混成一个问题。

## 1. 现在真正缺的，不只是“多一个灯”

raw-webgpu 当前的 museum 画面问题，本质上来自三段成像链不完整：

1. `离屏 post` 没真正进入稳定启用状态  
   现在 raw 里其实已经有 offscreen target、bloom composite、FXAA、hero floor、contact shadow 这些基础设施，但 museum QA 阶段为了避免坏的 offscreen pipeline 污染 command buffer，运行时被硬切回 direct canvas path。  
   这意味着：
   - 最终画面缺少统一的 display transform 落点
   - 高光 roll-off、局部 glow、边缘抗锯齿都不完整
   - 画面容易“灰但不润”

2. `环境反射` 仍然主要是程序化 room probe，而不是真正的 IBL  
   当前 raw 的 reflection 更接近“房间启发式反射”，不是 three.js / PBR 流程里的：
   - HDR environment
   - PMREM prefilter
   - roughness mip sampling
   - specular BRDF LUT

   所以材质会出现：
   - 黑材质不够“黑亮”
   - 金属边缘不够润
   - 玻璃和壳体缺少真实的环境层次

3. `specular IBL + final color pipeline` 还没有完全闭环  
   就算基础照明变好，没有完整的：
   - prefiltered env map
   - Fresnel / specular energy 约束
   - final tonemap / filmic shoulder / bloom merge

   仍然会有“能看清，但不高级”的结果。

## 2. 先做什么最值

### 第一优先级：恢复离屏 post 链

这是最值得先补的，因为：

- 代码里已经有大部分基础设施
- 不需要先重做所有材质系统
- 对 museum 质感的收益最大

目标：

- scene 先渲到 `rgba16float` offscreen
- transparent / glass / hero floor / contact shadow 继续维持各自 target
- final composite 统一走 bloom / tone / edge pass
- 最后再写回 canvas

预期收益：

- 天花板和地板不再“直接发灰”
- 亮部会更软，黑部更稳
- 高频边缘不再那么生硬

### 第二优先级：补 museum 专用环境反射，而不是立刻全量 PMREM

如果直接上完整 PMREM，全链成本很高。对我们现在最实用的做法是：

1. 先做 `museum environment source`
   - 一张或一组 museum neutral / dark-luxury 的环境贴图
   - 不再依赖 cool lab style probe

2. 做 `prefiltered env mip` 的最小实现
   - 可以先离线生成
   - 或用简化的 roughness bucket 方案

3. 为 raw material 增加 `envSpecularStrength / envTint / roughnessBias`

这样先把“高级感”补上，再决定是否完全追平 three.js 的 PMREM 实现。

### 第三优先级：完整 PMREM + BRDF LUT

这是长线正确方向，但不是最快让 level 3 好看的路径。

完整实现需要：

- HDR / env cubemap 或 octahedral env source
- prefilter convolution
- roughness mip chain
- BRDF integration LUT
- material specular IBL sampling
- specular occlusion

这套做完，raw-webgpu 的 museum 才会真正拥有接近成熟 PBR renderer 的“黑亮、润、厚”。

## 3. 推荐实现顺序

### Phase A: 让 post 重新可控启用

加一个显式开关，例如：

- `rawPost=1|0`
- 默认对 museum 开启

把运行时里写死的：

```ts
const postProcessEnabled = false;
```

改成质量开关函数控制。

同时要保证：

- offscreen pipeline 创建失败时自动回退 direct path
- 不污染整帧 command buffer
- bloom / FXAA / hero floor 可以独立开关

### Phase B: museum env profile

新增 museum 反射 profile，而不是继续依赖实验室风格的冷色 probe。

建议字段：

```ts
type RawMuseumEnvProfile = {
  envMapId: string;
  specularStrength: number;
  diffuseLift: number;
  roughnessBias: number;
  metalBoost: number;
  blackFloor: number;
  tintWarmth: number;
};
```

让 level 3 能从 config / render plan 选择：

- `museum_neutral_gallery`
- `museum_dark_luxury`
- `museum_white_box`

### Phase C: 最小 PMREM

如果我们不想一口气做全套，可以先做：

- 预烘焙 5 到 7 个 roughness mip 层
- shader 里按 roughness 取 nearest 或 linear blend

伪代码：

```ts
for each envProfile:
  load hdr_or_baked_env_faces()
  for roughnessLevel in levels:
    prefilter_env_for_roughness(roughnessLevel)
  save_prefiltered_env(envProfile)
```

shader 侧：

```wgsl
let refl = reflect(-viewDir, normal);
let lod = roughness * maxMip;
let specEnv = samplePrefilteredEnv(refl, lod);
let brdf = sampleBrdfLut(NoV, roughness);
let specular = specEnv * fresnel * brdf;
```

## 4. 现在可以立刻删除或弱化的旧思路

为了避免 museum 又被拉回“实验室感”，这些东西应持续弱化：

- cool lab reflection tint
- fake cyan probe bias
- 过重的 ceiling / side fill
- 语义色覆盖资源本色
- 依赖 role palette 直接给静态表面染色

这些不是完全不能用，而是不应该再作为 museum 默认主路径。

## 5. 对 Human Museum 的视觉目标

如果要给 AGE / renderer 一个明确目标，我建议用这组约束：

- 不是暗黑实验室
- 不是黄色酒店
- 不是灰白样板间
- 要有“白亮展厅 + 黑色高级材质 + 克制反射 + 局部危险感”

关键词：

- ceiling: clean bright neutral
- floor: deep charcoal with subtle sheen
- wall: soft ivory / stone white, not cyan, not dead gray
- metal: satin black, not flat gray
- glass: restrained blue-cyan only where object semantics require it
- shadow: present but not muddy
- highlights: small, controlled, elegant

## 6. 实话结论

可以补。

但要分清：

- `离屏 post` 是现在最该先补、也最容易见效的
- `环境反射` 需要从 museum env profile 开始，不要直接延续实验室 probe
- `完整 PMREM` 是正确的长期答案，但不是一下午就该假装补完的东西

如果只选一个最有性价比的下一步，就是：

1. 恢复稳定的 offscreen post chain  
2. 新增 museum env profile  
3. 再决定是否补最小 PMREM mip 链
