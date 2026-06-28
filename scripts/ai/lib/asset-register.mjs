/** 经 NODE_OPTIONS="--import ./scripts/ai/lib/asset-register.mjs" 注册资产桩 loader（与 tsx loader 链式叠加）。 */
import { register } from "node:module";
register(new URL("./asset-stub-loader.mjs", import.meta.url));
