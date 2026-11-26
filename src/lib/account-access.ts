export type AccountStatus = "pending" | "approved" | "rejected";

export function normalizeAccountStatus(status: unknown): AccountStatus | null {
  if (status === "pending" || status === "approved" || status === "rejected") {
    return status;
  }
  return null;
}

export function isAccountApproved(status: unknown): status is "approved" {
  return status === "approved";
}