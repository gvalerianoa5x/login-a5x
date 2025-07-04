/* eslint-disable @typescript-eslint/no-unused-vars */

import React, { useState } from "react";
import {
  Container,
  SpaceBetween,
  Button,
  Box,
  Alert,
  Link,
} from "@cloudscape-design/components";

import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
} from "amazon-cognito-identity-js";
import TextInput from "./components/TextInput";

interface LoginFormData {
  email: string;
  password: string;
}

interface LoginResponse {
  success: boolean;
  message: string;
  token?: string;
}

interface ValidationErrors {
  email?: string;
  password?: string;
}

type AlertType = "error" | "success" | "warning" | "info";

interface AlertState {
  show: boolean;
  type: AlertType;
  message: string;
}

const App: React.FC = () => {
  const [mfaCode, setMfaCode] = useState("");
  const [_forgotEmail, setForgotEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [cognitoUser, setCognitoUser] = useState<CognitoUser | null>(null);
  const [formData, setFormData] = useState<LoginFormData>({
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [alert, setAlert] = useState<AlertState>({
    show: false,
    type: "info",
    message: "",
  });
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>(
    {}
  );
  const [view, setView] = useState("login");

  const [newRequiredPassword, setNewRequiredPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const poolData = {
    UserPoolId: import.meta.env.VITE_USER_POOL_ID!,
    ClientId: import.meta.env.VITE_CLIENT_ID!,
  };

  const userPool = new CognitoUserPool(poolData);

  const validateEmail = (email: string): boolean =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const validateForm = (): boolean => {
    const errors: ValidationErrors = {};
    if (!formData.email) errors.email = "E-mail é obrigatório";
    else if (!validateEmail(formData.email))
      errors.email = "Por favor, insira um e-mail válido";
    if (!formData.password) errors.password = "Senha é obrigatória";
    else if (formData.password.length < 6)
      errors.password = "Senha deve ter pelo menos 6 caracteres";
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const showAlert = (type: AlertType, message: string): void => {
    setAlert({ show: true, type, message });
  };

  const hideAlert = (): void => {
    setAlert((prev) => ({ ...prev, show: false }));
  };

  const authenticateUser = async (
    loginData: LoginFormData
  ): Promise<LoginResponse> => {
    const userData = {
      Username: loginData.email,
      Pool: userPool,
    };

    const authenticationDetails = new AuthenticationDetails({
      Username: loginData.email,
      Password: loginData.password,
    });

    const user = new CognitoUser(userData);
    setCognitoUser(user);

    return new Promise((resolve) => {
      user.authenticateUser(authenticationDetails, {
        onSuccess: (result) => {
          const token = result.getAccessToken().getJwtToken();
          resolve({
            success: true,
            message: "Login realizado com sucesso!",
            token,
          });
        },
        onFailure: (err) => {
          resolve({
            success: false,
            message: "Erro de autenticação - Verifique o email e senha",
          });
        },
        mfaRequired: () => {
          setView("mfa");
          resolve({
            success: false,
            message: "Autenticação de dois fatores necessária.",
          });
        },
        newPasswordRequired: () => {
          setView("otp");
          resolve({
            success: false,
            message: "Nova senha necessária. Redirecionando...",
          });
        },
      });
    });
  };

  const handleMfaSubmit = () => {
    if (!cognitoUser) return;
    setLoading(true);
    cognitoUser.sendMFACode(mfaCode, {
      onSuccess: (result) => {
        const token = result.getAccessToken().getJwtToken();
        showAlert("success", "Autenticado com sucesso!");
        localStorage.setItem("authToken", token);
        setView("login");
      },
      onFailure: (err) => {
        showAlert("error", err.message || "Erro ao validar código MFA.");
      },
    });
    setLoading(false);
  };

  const handleResetPassword = () => {
    if (!cognitoUser) return;

    cognitoUser.confirmPassword(resetCode, newPassword, {
      onSuccess: () => {
        showAlert("success", "Senha redefinida com sucesso.");
        setView("login");
      },
      onFailure: (err) => {
        showAlert("error", err.message || "Erro ao redefinir senha.");
      },
    });
  };

  const handleInputChange = (
    field: keyof LoginFormData,
    value: string
  ): void => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (validationErrors[field])
      setValidationErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async (): Promise<void> => {
    hideAlert();
    if (!validateForm()) {
      showAlert("error", "Os campos de e-mail e senha são obrigatórios.");
      return;
    }
    setLoading(true);
    try {
      const response = await authenticateUser(formData);
      if (response.success) {
        showAlert("success", response.message);
        localStorage.setItem("authToken", response.token || "");
        window.location.href = "https://extranet-a5x.vercel.app/";
      } else showAlert("error", response.message);
    } catch (error) {
      showAlert("error", "Erro interno do servidor. Tente novamente.");
      console.error("Login error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    const email = formData.email;
    if (!validateEmail(email)) {
      showAlert("error", "Insira um e-mail válido para recuperar sua senha.");
      return;
    }
    setForgotEmail(email);
    const user = new CognitoUser({ Username: email, Pool: userPool });
    user.forgotPassword({
      onSuccess: () => {
        showAlert("info", "Um código foi enviado para seu e-mail.");
        setCognitoUser(user);
        setView("resetPassword");
      },
      onFailure: (err) => {
        showAlert(
          "error",
          err.message || "Erro ao solicitar redefinição de senha."
        );
      },
    });
  };

  const handleNewPasswordSubmit = () => {
    if (!cognitoUser) return;
    if (!newRequiredPassword || !confirmPassword) {
      showAlert("error", "Preencha todos os campos.");
      return;
    }
    if (newRequiredPassword !== confirmPassword) {
      showAlert("error", "As senhas não coincidem.");
      return;
    }

    setLoading(true);

    cognitoUser.completeNewPasswordChallenge(
      newRequiredPassword,
      {},
      {
        onSuccess: (session) => {
          const token = session.getAccessToken().getJwtToken();
          localStorage.setItem("authToken", token);
          showAlert("success", "Senha atualizada com sucesso!");
          setView("login");
          setLoading(false);
        },
        onFailure: (err) => {
          showAlert("error", err.message || "Erro ao definir nova senha.");
          setLoading(false);
        },
      }
    );
  };

  const handleTermsClick = (): void => {
    window.open("#", "_blank");
  };

  const handlePrivacyClick = (): void => {
    window.open("#", "_blank");
  };
  if (view === "mfa") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Container
            header={
              <div className="text-center py-6">
                <div className="flex items-center justify-center p-2">
                  <img src="/a5x-logo.svg" alt="a5x" />
                </div>
                <div className="text-sm text-gray-600 font-bold">
                  <label>Seja bem vindo a nossa extranet</label>
                </div>
              </div>
            }
          >
            <div className="flex flex-col items-center justify-center">
              <div className="w-full border-b-1 mb-2">
                <TextInput
                  value={mfaCode}
                  onChange={(value) => setMfaCode(value)}
                  placeholder="Digite o código MFA"
                  disabled={loading}
                />
              </div>
              <Button onClick={handleMfaSubmit} loading={loading}>
                Validar código
              </Button>
            </div>
          </Container>
          <Box margin={{ top: "xl" }}>
            <div className="text-center space-y-2">
              <div className="flex flex-col sm:flex-row justify-center items-center gap-4 text-xs text-gray-500">
                <Link
                  href="#"
                  onFollow={(e) => {
                    e.preventDefault();
                    handleTermsClick();
                  }}
                  fontSize="body-s"
                  color="normal"
                >
                  Termos e condições
                </Link>
                <Link
                  href="#"
                  onFollow={(e) => {
                    e.preventDefault();
                    handlePrivacyClick();
                  }}
                  fontSize="body-s"
                  color="normal"
                >
                  Política de privacidade
                </Link>
              </div>
              <div className="text-xs text-gray-400">
                © {new Date().getFullYear()} A5X Bolsa de Valores. Todos os
                direitos reservados.
              </div>
            </div>
          </Box>
        </div>
      </div>
    );
  }

  if (view === "resetPassword") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Container
            header={
              <div className="text-center py-6">
                <div className="flex items-center justify-center p-2">
                  <img src="/a5x-logo.svg" alt="a5x" />
                </div>
                <div className="text-sm text-gray-600 font-bold">
                  <label>Seja bem vindo a nossa extranet</label>
                </div>
              </div>
            }
          >
            <div className="w-full border-b-1 mb-2">
              <TextInput
                value={resetCode}
                onChange={(value) => setResetCode(value)}
                placeholder="Código recebido"
              />
            </div>
            <div className="w-full border-b-1 mb-2">
              <TextInput
                type="password"
                value={newPassword}
                onChange={(value) => setNewPassword(value)}
                placeholder="Nova senha"
              />
            </div>
            <div className="flex items-center justify-center">
              <Button onClick={handleResetPassword}>Redefinir senha</Button>
            </div>
          </Container>
        </div>
      </div>
    );
  }

  if (view === "otp") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Container
            header={
              <div className="text-center py-6">
                <div className="flex items-center justify-center p-2">
                  <a href="https://login-a5x.vercel.app/">
                    <img src="/a5x-logo.svg" alt="a5x" />
                  </a>
                </div>
                <div className="text-sm text-gray-600 font-bold flex flex-col">
                  <span className="font-bold p-1">Redefinir senha</span>
                </div>
              </div>
            }
          >
            <div className="flex flex-col items-center justify-center">
              <div className="w-full border-b-1 mb-2">
                <TextInput
                  type={showPassword ? "text" : "password"}
                  value={newRequiredPassword}
                  onChange={(value) => setNewRequiredPassword(value)}
                  placeholder="Nova senha"
                />
              </div>
              <div className="w-full border-b-1 mb-2">
                <TextInput
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(value) => setConfirmPassword(value)}
                  placeholder="Confirme a nova senha"
                />
              </div>
              <div className="flex items-center justify-center">
                <Button onClick={handleNewPasswordSubmit} loading={loading}>
                  Definir nova senha
                </Button>
              </div>
            </div>
          </Container>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Container
          header={
            <div className="text-center py-6">
              <div className="flex items-center justify-center p-2">
                <img src="/a5x-logo.svg" alt="a5x" />
              </div>
              <div className="text-sm text-gray-600 font-bold">
                <label>Seja bem vindo a nossa extranet</label>
              </div>
            </div>
          }
        >
          <div>
            <SpaceBetween direction="vertical" size="l">
              {alert.show && (
                <Alert
                  statusIconAriaLabel={
                    alert.type.charAt(0).toUpperCase() + alert.type.slice(1)
                  }
                  type={alert.type}
                  dismissible
                  onDismiss={hideAlert}
                >
                  {alert.message}
                </Alert>
              )}
              <div className="relative w-full border-b-1">
                <TextInput
                  type="email"
                  value={formData.email}
                  onChange={(value) => handleInputChange("email", value)}
                  placeholder="E-mail"
                  disabled={loading}
                />
              </div>
              <div className="relative w-full border-b-1">
                <button
                  className={`h-4 w-4 ${
                    showPassword
                      ? "bg-[url(assets/eye.svg)]"
                      : "bg-[url(assets/eye-slash.svg)]"
                  } bg-no-repeat p-1 absolute right-0 cursor-pointer`}
                  onClick={(_e: React.MouseEvent<HTMLButtonElement>) =>
                    setShowPassword(!showPassword)
                  }
                  type="button"
                ></button>
                <TextInput
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(value) => handleInputChange("password", value)}
                  placeholder="Senha"
                  disabled={loading}
                />
              </div>
              <Box textAlign="right">
                <Button
                  variant="inline-link"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                  ariaLabel={showPassword ? "Ocultar senha" : "Mostrar senha"}
                />
              </Box>
              <Box textAlign="right">
                <Link
                  onFollow={(e) => {
                    e.preventDefault();
                    handleForgotPassword();
                  }}
                  fontSize="body-s"
                >
                  Esqueci minha senha
                </Link>
              </Box>
              <Button
                variant="primary"
                fullWidth
                loading={loading}
                loadingText="Autenticando..."
                onClick={handleSubmit}
                disabled={loading}
              >
                LOGIN
              </Button>
            </SpaceBetween>
          </div>
        </Container>
        <Box margin={{ top: "xl" }}>
          <div className="text-center space-y-2">
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4 text-xs text-gray-500">
              <Link
                href="#"
                onFollow={(e) => {
                  e.preventDefault();
                  handleTermsClick();
                }}
                fontSize="body-s"
                color="normal"
              >
                Termos e condições
              </Link>
              <Link
                href="#"
                onFollow={(e) => {
                  e.preventDefault();
                  handlePrivacyClick();
                }}
                fontSize="body-s"
                color="normal"
              >
                Política de privacidade
              </Link>
            </div>
            <div className="text-xs text-gray-400">
              © {new Date().getFullYear()} A5X Bolsa de Valores. Todos os
              direitos reservados.
            </div>
          </div>
        </Box>
      </div>
    </div>
  );
};

export default App;
