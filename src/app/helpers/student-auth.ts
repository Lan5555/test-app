import type { sessionType } from "../components/toast";
import { CoreService } from "./api-handler";
import { Users } from "./factories";

export async function authenticateStudent(
  email: string,
  code: string,
  service: Pick<CoreService, "send"> = new CoreService(),
) {
  const credentials = { email: email.trim(), code: code.trim() };
  if (!credentials.email || !credentials.code)
    throw new Error("Enter your email address and personal access code.");
  const response = await service.send("/users/api/login-student", credentials);
  if (!response.success)
    throw new Error(
      response.message ||
        "We couldn’t sign you in. Check your email and access code, then try again.",
    );
  if (
    !response.data ||
    typeof response.data.token !== "string" ||
    !response.data.token.trim()
  )
    throw new Error("Sign-in could not be completed. Please try again.");
  const student = Users.fromJson(response.data);
  if (!Number.isFinite(Number(student.id)) || Number(student.id) <= 0)
    throw new Error(
      "Your student profile could not be loaded. Please try again.",
    );
  const quizId = Number(student.quizId);
  const session: sessionType = {
    type: "user",
    code: credentials.code.toUpperCase(),
    name: student.name || credentials.email,
    quizId: Number.isInteger(quizId) && quizId > 0 ? quizId : 0,
    token: response.data.token,
  };
  return { student, session, message: response.message || "Welcome back." };
}
