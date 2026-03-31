/**
 * 易客天气 免费实况接口文档：https://www.yiketianqi.com/index/doc?version=day
 * city / cityid / ip 三选一；不传则按 IP。appid、appsecret 见控制台。
 */

const DAY_URL = "https://v1.yiketianqi.com/free/day";
const FETCH_MS = 12_000;

type DayPayload = {
  errcode?: number;
  errmsg?: string;
  city?: string;
  cityid?: string;
  date?: string;
  week?: string;
  update_time?: string;
  wea?: string;
  tem?: string;
  tem_day?: string;
  tem_night?: string;
  win?: string;
  win_speed?: string;
  humidity?: string;
  air?: string;
};

/** 文档建议 city 不要带「市」「区」，尽量缩短地名 */
export function normalizeCityForYiketianqi(raw: string): string {
  let s = raw.trim();
  if (!s) return "北京";
  if (s.includes(",")) s = s.split(",")[0].trim();
  s = s.replace(/^(中国|中國)\s*/, "");
  s = s.replace(/(特别行政区|自治州|自治县|自治区)$/, "");
  s = s.replace(/[市县区]$/, "");
  return s.trim() || raw.trim();
}

export async function fetchYiketianqiDayWeather(location: string): Promise<string> {
  const appid = process.env.YIKETIANQI_APPID?.trim();
  const appsecret = process.env.YIKETIANQI_APPSECRET?.trim();
  if (!appid || !appsecret) {
    return "错误：服务端未配置 YIKETIANQI_APPID / YIKETIANQI_APPSECRET，无法查询实况天气。";
  }

  const city = normalizeCityForYiketianqi(location);
  const params = new URLSearchParams({
    appid,
    appsecret,
    city,
    unescape: "1",
  });

  let res: Response;
  try {
    res = await fetch(`${DAY_URL}?${params.toString()}`, {
      method: "GET",
      signal: AbortSignal.timeout(FETCH_MS),
      headers: { Accept: "application/json" },
    });
  } catch (e: unknown) {
    return `天气接口请求失败：${e instanceof Error ? e.message : String(e)}`;
  }

  let data: DayPayload;
  try {
    data = (await res.json()) as DayPayload;
  } catch {
    return "天气接口返回非 JSON，请稍后重试。";
  }

  if (typeof data.errcode === "number" && data.errcode !== 0) {
    return `天气接口错误：${data.errmsg ?? `errcode=${data.errcode}`}`;
  }

  if (!data.city && !data.wea) {
    return `天气接口异常：${JSON.stringify(data).slice(0, 500)}`;
  }

  const parts = [
    `城市：${data.city ?? city}`,
    data.date ? `日期：${data.date}${data.week ? ` ${data.week}` : ""}` : null,
    data.update_time ? `观测时间：${data.update_time}` : null,
    data.wea ? `天气：${data.wea}` : null,
    data.tem != null ? `当前气温约 ${data.tem}℃` : null,
    data.tem_day != null && data.tem_night != null
      ? `白天 ${data.tem_day}℃ / 夜间 ${data.tem_night}℃`
      : null,
    data.win && data.win_speed ? `${data.win} ${data.win_speed}` : data.win ?? null,
    data.humidity ? `湿度：${data.humidity}` : null,
    data.air != null ? `空气指数参考：${data.air}` : null,
  ].filter(Boolean);

  return parts.join("；");
}
