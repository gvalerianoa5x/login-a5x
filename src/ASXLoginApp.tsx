
import React, { useState } from 'react';
import {
  Container,
  SpaceBetween,
  Button,
  Box,
  Alert,
  Link
} from '@cloudscape-design/components';
import { CognitoIdentityProviderClient, InitiateAuthCommand } from "@aws-sdk/client-cognito-identity-provider";

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

type AlertType = 'error' | 'success' | 'warning' | 'info';

interface AlertState {
  show: boolean;
  type: AlertType;
  message: string;
}

const ASXLoginApp: React.FC = () => {
  const [formData, setFormData] = useState<LoginFormData>({ email: '', password: '' });
  const config = { region: "us-east-1" };
  const cognitoClient = new CognitoIdentityProviderClient(config);
  const clientId = "2b95s6s1ntfv6l2q9jspe5tcdf";
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [alert, setAlert] = useState<AlertState>({ show: false, type: 'info', message: '' });
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [view, setView] = useState("login");
  const [session, setSession] = useState("");

  const validateEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const validateForm = (): boolean => {
    const errors: ValidationErrors = {};
    if (!formData.email) errors.email = 'E-mail é obrigatório';
    else if (!validateEmail(formData.email)) errors.email = 'Por favor, insira um e-mail válido';
    if (!formData.password) errors.password = 'Senha é obrigatória';
    else if (formData.password.length < 6) errors.password = 'Senha deve ter pelo menos 6 caracteres';
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const showAlert = (type: AlertType, message: string): void => {
    setAlert({ show: true, type, message });
  };

  const hideAlert = (): void => {
    setAlert(prev => ({ ...prev, show: false }));
  };

  const authenticateUser = async (loginData: LoginFormData): Promise<LoginResponse> => {
    const input = {
      AuthFlow: "USER_PASSWORD_AUTH",
      AuthParameters: {
        USERNAME: loginData.email,
        PASSWORD: loginData.password,
      },
      ClientId: clientId,
    };
    const command = new InitiateAuthCommand(input);
    const response = await cognitoClient.send(command);
    console.log(response);
    if (response.ChallengeName === "NEW_PASSWORD_REQUIRED") {
      if (response !== undefined) setSession(response.Session || "");
      setView('otp');
    } else if (response['$metadata']['httpStatusCode'] === 200) alert("Login Successfull!");
    return { success: true, message: "Autenticado", token: "" }; // ajuste conforme necessário
  };

  const handleInputChange = (field: keyof LoginFormData, value: string): void => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (validationErrors[field]) setValidationErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async (): Promise<void> => {
    hideAlert();
    if (!validateForm()) {
      showAlert('error', 'Por favor, corrija os erros abaixo.');
      return;
    }
    setLoading(true);
    try {
      const response = await authenticateUser(formData);
      if (response.success) {
        showAlert('success', response.message);
        localStorage.setItem('authToken', response.token || '');
      } else showAlert('error', response.message);
    } catch (error) {
      showAlert('error', 'Erro interno do servidor. Tente novamente.');
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = (): void => {
    showAlert('info', 'Funcionalidade de recuperação de senha será implementada em breve.');
  };

  const handleTermsClick = (): void => {
    window.open('#', '_blank');
  };

  const handlePrivacyClick = (): void => {
    window.open('#', '_blank');
  };

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
                  statusIconAriaLabel={alert.type.charAt(0).toUpperCase() + alert.type.slice(1)}
                  type={alert.type}
                  dismissible
                  onDismiss={hideAlert}
                >
                  {alert.message}
                </Alert>
              )}
              <div className="relative w-full border-b-1">
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('email', e.target.value)}
                  placeholder="E-mail"
                  disabled={loading}
                  className="w-full"
                />
              </div>
              <div className="relative w-full border-b-1">
                <button
                  className={`h-4 w-4 ${showPassword ? 'bg-[url(eye.svg)]' : 'bg-[url(eye-slash.svg)]'} bg-no-repeat p-1 absolute right-0 cursor-pointer`}
                  onClick={(e: React.MouseEvent<HTMLButtonElement>) => setShowPassword(!showPassword)}
                  type="button"
                ></button>
                <input
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  placeholder="Senha"
                  disabled={loading}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('password', e.target.value)}
                  className="w-72"
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
              <Box textAlign="center">
                <Button
                  variant="link"
                  onClick={() => setFormData({ email: 'p-guilherme.valeriano@a5x.com.br', password: '123456' })}
                  disabled={loading}
                >
                  <small>Preencher dados de teste</small>
                </Button>
              </Box>
            </SpaceBetween>
          </div>
        </Container>
        <Box margin={{ top: "xl" }}>
          <div className="text-center space-y-2">
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4 text-xs text-gray-500">
              <Link href="#" onFollow={(e) => { e.preventDefault(); handleTermsClick(); }} fontSize="body-s" color="normal">
                Termos e condições
              </Link>
              <Link href="#" onFollow={(e) => { e.preventDefault(); handlePrivacyClick(); }} fontSize="body-s" color="normal">
                Política de privacidade
              </Link>
            </div>
            <div className="text-xs text-gray-400">
              © {new Date().getFullYear()} ASX Bolsa de Valores. Todos os direitos reservados.
            </div>
          </div>
        </Box>
      </div>
    </div>
  );
};

export default ASXLoginApp;
