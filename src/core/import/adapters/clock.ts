// Written with the help of Claude
/** The time now. A port of its own so the tests can set it. */
export abstract class Clock {
  abstract now(): Date;
}
