export const SESSION_CAPACITY_ERROR_CODE = "SESSION_CAPACITY_REACHED";

export type StudentAdmission = {
  status: "admitted" | "full";
  limit: number | null;
  connectedParticipants: number | null;
};
