"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { authenticateStudent } from "../helpers/student-auth";
import StudentSignInView from "./student/sign-in-view";
import { useToast } from "./toast";

export default function StudentLoginModal() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestInFlight = useRef(false);
  const router = useRouter();
  const { addToast, setStudentInfo, setState, setSessionData } = useToast();

  async function handleLogin() {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setLoading(true);
    setError("");
    try {
      const result = await authenticateStudent(email, code);
      sessionStorage.setItem("userSession", JSON.stringify(result.session));
      setStudentInfo(result.student);
      setSessionData(result.session);
      addToast(result.message, "success");
      router.push("/pages/student");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "We couldn’t sign you in. Please try again.",
      );
    } finally {
      setLoading(false);
      requestInFlight.current = false;
    }
  }

  return (
    <StudentSignInView
      email={email}
      code={code}
      showCode={showCode}
      loading={loading}
      error={error}
      onEmailChange={(value) => {
        setEmail(value);
        setError("");
      }}
      onCodeChange={(value) => {
        setCode(value);
        setError("");
      }}
      onToggleCode={() => setShowCode((value) => !value)}
      onSubmit={() => void handleLogin()}
      onBack={() => setState(false)}
    />
  );
}
