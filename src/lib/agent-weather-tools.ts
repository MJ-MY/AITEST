import { fetchYiketianqiDayWeather } from "@/lib/yiketianqi-weather";

/** OpenAI 兼容的 tools 定义，供 MiniMax chat/completions 使用 */

/** 用于首轮请求是否强制调用 get_weather（降低模型「拒答」概率） */
export function isLikelyWeatherQuestion(text: string): boolean {
  return /天气|气温|下雨|降雨|刮风|温度|多少度|冷不|热不|带伞|穿衣|预报|多云|晴天|阴天|雪|雾|霾|紫外线|出门|穿什么|潮湿|闷热|降温|升温/.test(
    text,
  );
}

export const WEATHER_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "get_weather",
      description:
        "查询指定地点的当日实况天气（易客天气接口）。用户询问天气、气温、是否下雨等时应调用；参数 location 为城市名，如 北京、佛山、广州。",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "城市名，中文即可，如 佛山、北京；可含「市」字，服务端会规范化。",
          },
        },
        required: ["location"],
      },
    },
  },
];

/** @deprecated 兼容旧名 */
export const MOCK_WEATHER_TOOLS = WEATHER_TOOLS;

export async function runWeatherTool(name: string, argumentsJson: string): Promise<string> {
  if (name !== "get_weather") {
    return `错误：未知工具「${name}」`;
  }
  let location = "";
  try {
    const args = JSON.parse(argumentsJson) as { location?: string };
    location = typeof args.location === "string" ? args.location : "";
  } catch {
    return "错误：工具参数不是合法 JSON";
  }
  return fetchYiketianqiDayWeather(location);
}
