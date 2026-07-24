export class PromiseSettledError extends Error {
  constructor(public readonly reason: unknown) {
    super(reason instanceof Error ? reason.message : String(reason));

    this.name = "PromiseSettledError";
  }
}

type SettledValues<T extends readonly unknown[]> = {
  -readonly [K in keyof T]: Awaited<T[K]> | PromiseSettledError;
};

export async function allSettledValues<const T extends readonly unknown[]>(
  promises: T,
): Promise<SettledValues<T>> {
  const results = await Promise.allSettled(promises);

  return results.map((result) => {
    if (result.status === "fulfilled") {
      return result.value;
    }

    return new PromiseSettledError(result.reason);
  }) as SettledValues<T>;
}

type WithoutPromiseSettledError<T extends readonly unknown[]> = {
  [K in keyof T]: Exclude<T[K], PromiseSettledError>;
};

export function hasNoPromiseSettledError<const T extends readonly unknown[]>(
  results: T,
): results is T & WithoutPromiseSettledError<T> {
  return results.every((result) => !(result instanceof PromiseSettledError));
}
