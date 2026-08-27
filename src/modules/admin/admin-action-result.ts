export type AdminActionResult = {
  ok: boolean;
  message: string;
};

export function adminActionSuccess(message: string): AdminActionResult {
  return { ok: true, message };
}

export function adminActionError(message: string): AdminActionResult {
  return { ok: false, message };
}
