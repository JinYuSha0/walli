type PickFunctions<T> = {
  [K in keyof T as T[K] extends (...args: infer _Args) => unknown ? K : never]: T[K];
};
