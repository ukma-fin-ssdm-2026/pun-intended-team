// Written with the help of Claude
/** Whole years between a date of birth and a day, both YYYY-MM-DD. */
export function ageOn(today: string, dateOfBirth: string): number {
  const [year = 0, month = 0, day = 0] = today.split('-').map(Number);
  const [birthYear = 0, birthMonth = 0, birthDay = 0] = dateOfBirth.split('-').map(Number);
  const hadBirthday = month > birthMonth || (month === birthMonth && day >= birthDay);
  return year - birthYear - (hadBirthday ? 0 : 1);
}
