/**
 * A simple Result<T, E> for expected-failure code paths.
 *
 * Use Result for *expected* failures (gate checks, validation, not-found).
 * Use thrown exceptions for *unexpected* failures (DB down, bug).
 *
 * Never mix: if a function returns Result, it should not also throw for the
 * same failure mode.
 */
export type Ok<T> = { ok: true; value: T };
export type Err<E> = { ok: false; error: E };
export type Result<T, E = string> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

export function isOk<T, E>(r: Result<T, E>): r is Ok<T> {
  return r.ok === true;
}

export function isErr<T, E>(r: Result<T, E>): r is Err<E> {
  return r.ok === false;
}
