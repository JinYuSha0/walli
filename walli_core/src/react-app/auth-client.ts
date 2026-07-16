import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  fetchOptions: {
    credentials: "include",
  },
  plugins: [adminClient()],
});
