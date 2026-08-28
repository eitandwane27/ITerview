import React from 'react';
import AuthModal from '../components/AuthModal';

export default function Login() {
  return <AuthModal isPage={true} initialMode="login" />;
}
