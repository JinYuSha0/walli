export function source(code: string) {
  return {
    docs: {
      source: {
        code,
        language: "tsx",
      },
    },
  };
}
