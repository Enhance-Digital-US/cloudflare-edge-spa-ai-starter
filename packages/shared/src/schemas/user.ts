import { z } from "zod";

export const UserSchema = z.object({
  email: z.email(),
  id: z.string().min(1),
});
