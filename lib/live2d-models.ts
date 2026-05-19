// Phase D: built-in Live2D model catalog.
// Order of this array is the canonical modelId index passed to live2d-widget's
// initWidget({ modelId }). public/live2d/widget/waifu-tips.json's "models"
// array must stay in the same order.

export type BuiltinModel = {
  /** stable url-safe slug, also stored in DB Live2DSettings.modelId */
  id: string
  /** display label (latin) */
  name: string
  /** notes shown in settings (optional) */
  description?: string
  /** absolute public path to the model3.json (no domain) */
  modelJson: string
  /**
   * Absolute public path to a preview image. Pulls from each model's first
   * texture atlas; next/image resizes it to a small thumbnail at request time
   * so no extra build-time assets are shipped.
   */
  previewImage: string
  /** Optional short caption shown under thumbnails in the picker. */
  tags?: string[]
}

export const BUILTIN_MODELS: BuiltinModel[] = [
  {
    id: "mao_pro",
    name: "Mao Pro",
    description: "Live2D official sample (default). Reacts to head + body taps.",
    modelJson: "/live2d/models/mao_pro/mao_pro.model3.json",
    previewImage: "/live2d/models/mao_pro/mao_pro.4096/texture_00.png",
    tags: ["girl", "default"],
  },
  {
    id: "haru_greeter",
    name: "Haru Greeter",
    description: "27 greeter motions, no tap reactions.",
    modelJson: "/live2d/models/haru_greeter/haru_greeter_t05.model3.json",
    previewImage: "/live2d/models/haru_greeter/haru_greeter_t05.2048/texture_00.png",
    tags: ["girl", "expressive"],
  },
  {
    id: "hiyori_pro",
    name: "Hiyori Pro",
    description: "Reacts to body taps.",
    modelJson: "/live2d/models/hiyori_pro/hiyori_pro_t11.model3.json",
    previewImage: "/live2d/models/hiyori_pro/hiyori_pro_t11.2048/texture_00.png",
    tags: ["girl"],
  },
  {
    id: "natori",
    name: "Natori",
    description: "Reacts to head + body taps.",
    modelJson: "/live2d/models/natori/natori_pro_t06.model3.json",
    previewImage: "/live2d/models/natori/natori_pro_t06.4096/texture_00.png",
    tags: ["boy"],
  },
  {
    id: "ren",
    name: "Ren",
    description: "Reacts to head + body taps.",
    modelJson: "/live2d/models/ren/ren.model3.json",
    previewImage: "/live2d/models/ren/ren.4096/texture_00.png",
    tags: ["boy"],
  },
  {
    id: "rice",
    name: "Rice",
    description: "Reacts to body taps.",
    modelJson: "/live2d/models/rice/rice_pro_t03.model3.json",
    previewImage: "/live2d/models/rice/rice_pro_t03.2048/texture_00.png",
    tags: ["girl"],
  },
  {
    id: "miara",
    name: "Miara",
    modelJson: "/live2d/models/miara/miara_pro_t03.model3.json",
    previewImage: "/live2d/models/miara/miara_pro_t03.4096/texture_00.png",
    tags: ["girl"],
  },
  {
    id: "miku",
    name: "Miku (sample)",
    modelJson: "/live2d/models/miku/miku_sample_t04.model3.json",
    previewImage: "/live2d/models/miku/miku_sample_t04.2048/texture_00.png",
    tags: ["sample"],
  },
  {
    id: "chitose",
    name: "Chitose",
    modelJson: "/live2d/models/chitose/chitose.model3.json",
    previewImage: "/live2d/models/chitose/chitose.2048/texture_00.png",
    tags: ["girl"],
  },
  {
    id: "epsilon",
    name: "Epsilon",
    modelJson: "/live2d/models/epsilon/Epsilon.model3.json",
    previewImage: "/live2d/models/epsilon/Epsilon.1024/texture_00.png",
    tags: ["girl"],
  },
  {
    id: "gantzert",
    name: "Gantzert Felixander",
    modelJson: "/live2d/models/gantzert/Gantzert_Felixander.model3.json",
    previewImage: "/live2d/models/gantzert/Gantzert_Felixander.2048/texture_00.png",
    tags: ["chibi"],
  },
  {
    id: "izumi",
    name: "Izumi (illustration)",
    modelJson: "/live2d/models/izumi/izumi_illust.model3.json",
    previewImage: "/live2d/models/izumi/izumi_illust.1024/texture_00.png",
    tags: ["girl"],
  },
  {
    id: "shizuku",
    name: "Shizuku",
    modelJson: "/live2d/models/shizuku/shizuku.model3.json",
    previewImage: "/live2d/models/shizuku/shizuku.1024/texture_00.png",
    tags: ["girl"],
  },
  {
    id: "tsumiki",
    name: "Tsumiki",
    modelJson: "/live2d/models/tsumiki/tsumiki.model3.json",
    previewImage: "/live2d/models/tsumiki/tsumiki.2048/texture_00.png",
    tags: ["girl"],
  },
  {
    id: "unitychan",
    name: "Unity-chan",
    modelJson: "/live2d/models/unitychan/unitychan.model3.json",
    previewImage: "/live2d/models/unitychan/unitychan.2048/texture_00.png",
    tags: ["mascot"],
  },
  {
    id: "wanko",
    name: "Wanko (dog)",
    modelJson: "/live2d/models/wanko/wanko_touch.model3.json",
    previewImage: "/live2d/models/wanko/wanko_touch.1024/texture_00.png",
    tags: ["pet"],
  },
  {
    id: "nito",
    name: "Nito",
    modelJson: "/live2d/models/nito/nito.model3.json",
    previewImage: "/live2d/models/nito/nito/nito.2048/texture_00.png",
    tags: ["chibi"],
  },
  {
    id: "tororo",
    name: "Tororo (cat)",
    modelJson: "/live2d/models/tororo/tororo.model3.json",
    previewImage: "/live2d/models/tororo/tororo.2048/texture_00.png",
    tags: ["pet"],
  },
  {
    id: "hijiki",
    name: "Hijiki (cat)",
    modelJson: "/live2d/models/hijiki/hijiki.model3.json",
    previewImage: "/live2d/models/hijiki/hijiki.2048/texture_00.png",
    tags: ["pet"],
  },
]

export const DEFAULT_MODEL_ID = "mao_pro"

export function findModelIndex(id: string): number {
  const idx = BUILTIN_MODELS.findIndex((m) => m.id === id)
  return idx >= 0 ? idx : 0
}

export function isValidModelId(id: string): boolean {
  return BUILTIN_MODELS.some((m) => m.id === id)
}
