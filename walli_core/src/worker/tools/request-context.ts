import { getAsyncContext } from "../lib/async-context";

// Internal tool requests inherit the caller's context; direct API requests use their body.
export const resolveToolRequestIdentity = (body: unknown): unknown => {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return body;
  const { userInfo } = getAsyncContext();
  if (!userInfo) return body;
  return {
    ...body,
    clientId: userInfo.clientId,
    ...(userInfo.notificationChannel ? { clientPlatform: userInfo.notificationChannel.type } : {}),
  };
};
