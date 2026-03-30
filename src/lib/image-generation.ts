/** MiniMax 文生图模型（与 chat/completions 不同） */
export const IMAGE_GEN_MODEL = "image-01" as const;

export const IMAGE_ASPECT_RATIOS = [
  "1:1",
  "16:9",
  "4:3",
  "3:2",
  "2:3",
  "3:4",
  "9:16",
  "21:9",
] as const;

export type ImageAspectRatio = (typeof IMAGE_ASPECT_RATIOS)[number];
