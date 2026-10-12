// ทุกการคำนวณเวลาใช้เวลาประเทศไทย ไม่ใช่เวลาของ server
const TIME_ZONE = 'Asia/Bangkok';

// วันที่ตามเวลาไทย เช่น 2026-10-12 (เก็บลงคอลัมน์ @db.Date)
export function toBangkokDate(date: Date): Date {
  const dateString = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
  return new Date(`${dateString}T00:00:00.000Z`);
}

// เวลาไทยนับเป็นนาทีตั้งแต่เที่ยงคืน เช่น 08:15 = 495
export function toBangkokMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value);
  return hour * 60 + minute;
}

// แปลง "08:00" เป็น 480
export function parseTime(value: string): number {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}
