import React from "react";
import AuthModal from "../components/AuthModal";

export default function Register() {
  return <AuthModal isPage={true} initialMode="register" />;
}
