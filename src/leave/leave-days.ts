export function toDateOnly(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

export function countWeekdays(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);

  while (current <= end) {
    const day = current.getUTCDay();
    if (day !== 0 && day !== 6) {
      count++;
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return count;
}
