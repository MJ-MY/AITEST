/**
 * 对话使用的模型 ID（与 MiniMax OpenAI 兼容接口的 model 字段一致）。
 * 接口不会自动把「你是 MiniMax」写进模型上下文，需在 system 里说明，否则用户问「你是什么模型」时常会答不知道。
 */
export const CHAT_MODEL = "MiniMax-M2.7";

const PROVIDER = "MiniMax";
const PROVIDER_CN = "稀宇科技";
const ASSISTANT = "AI小博士";

/** 生成发给大模型的 system 文案（身份与模型名与上方配置一致） */
export function buildChatSystemPrompt(modelId: string): string {
  const identity = `你是由 ${PROVIDER}（${PROVIDER_CN}）大模型驱动的中文助手「${ASSISTANT}」。当前请求使用的模型 ID 为「${modelId}」。当用户问厂商、底层模型或名称时，如实说明：${PROVIDER}，当前为 ${modelId}；勿说不知道或拒绝回答。`;
  return `${identity}\n回答简洁有条理。`;
}
