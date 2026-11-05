/**
 * 随机昵称：「形容词的物件」，如「安静的鼠标」「热心的灯塔」
 *
 * 用 crypto 随机，避免 Math.random 在短时间内的可预测性。
 */

const ADJECTIVES = [
  "安静的", "热心的", "缓慢的", "明亮的", "沉默的", "灵巧的", "温和的",
  "认真的", "好奇的", "淡定的", "敏捷的", "踏实的", "清醒的", "自在的",
  "散漫的", "专注的", "早起的", "慢热的", "憨厚的", "机警的",
];

const NOUNS = [
  "鼠标", "键盘", "台灯", "书架", "马克杯", "灯泡", "齿轮", "纸鸢",
  "灯塔", "邮差", "园丁", "旅人", "木匠", "猫头鹰", "水獭", "刺猬",
  "松鼠", "云雀", "海豹", "小鹿", "收音机", "老唱片", "折扇", "竹筏",
];

function pick<T>(list: T[]): T {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return list[buf[0] % list.length];
}

export function randomNickname(): string {
  return `${pick(ADJECTIVES)}${pick(NOUNS)}`;
}

/** 用户没设昵称时的展示名：已有昵称就用，空的话给一个稳定的默认（不落库） */
export function displayName(name: string | null | undefined, email: string): string {
  const trimmed = (name ?? "").trim();
  if (trimmed) return trimmed;
  return email.split("@")[0];
}
