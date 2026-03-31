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

/** Agent：工具调用说明（后续新增工具时在此集中维护） */
export function buildAgentToolInstructions(): string {
  return [
    "【必须遵守】你已接入 get_weather 工具，可查询城市当日实况天气（易客天气接口）。",
    "用户问天气、气温、是否下雨、刮风、穿衣建议等时，必须先调用 get_weather，参数 location 填城市名（如 佛山、北京、广州）。",
    "禁止在未调用 get_weather 之前回答「无法获取实时天气」「我不能查询天气」等；先调工具，再据返回内容用中文简洁回答。",
  ].join("");
}

/** Agent 模式完整 system（工具规范放在前面，避免被通用「助手」人设覆盖） */
export function buildAgentSystemPrompt(modelId: string): string {
  return `${buildAgentToolInstructions()}\n\n${buildChatSystemPrompt(modelId)}`;
}
