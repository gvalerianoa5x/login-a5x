/* eslint-disable @typescript-eslint/no-unused-vars */

import React, { useState } from 'react';
import {
  Container,
  SpaceBetween,
  Button,
  Box,
  Alert,
  Link
} from '@cloudscape-design/components';

import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails
} from 'amazon-cognito-identity-js';

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

const App: React.FC = () => {
  const [mfaCode, setMfaCode] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [cognitoUser, setCognitoUser] = useState<CognitoUser | null>(null);
  const [formData, setFormData] = useState<LoginFormData>({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [alert, setAlert] = useState<AlertState>({ show: false, type: 'info', message: '' });
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [view, setView] = useState("login");

  const [newRequiredPassword, setNewRequiredPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const poolData = {
    UserPoolId: 'sa-east-1_3HSzX2V6l', // <- Substitua pelo seu
    ClientId: '2b95s6s1ntfv6l2q9jspe5tcdf'
  };
  
  const userPool = new CognitoUserPool(poolData);

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
    const userData = {
      Username: loginData.email,
      Pool: userPool
    };
  
    const authenticationDetails = new AuthenticationDetails({
      Username: loginData.email,
      Password: loginData.password
    });
  
    const user = new CognitoUser(userData);
    setCognitoUser(user);
  
    return new Promise((resolve) => {
      user.authenticateUser(authenticationDetails, {
        onSuccess: (result) => {
          const token = result.getAccessToken().getJwtToken();
          resolve({ success: true, message: 'Login realizado com sucesso!', token });
        },
        onFailure: (err) => {
          resolve({ success: false, message: err.message || 'Erro de autenticação.' });
        },
        mfaRequired: () => {
          setView('mfa');
          resolve({ success: false, message: 'Autenticação de dois fatores necessária.' });
        },
        newPasswordRequired: () => {
          setView('otp');
          resolve({ success: false, message: 'Nova senha necessária. Redirecionando...' });
        }
      });
    });
  };

  const handleMfaSubmit = () => {
    if (!cognitoUser) return;
    setLoading(true);
    cognitoUser.sendMFACode(mfaCode, {
      onSuccess: (result) => {
        const token = result.getAccessToken().getJwtToken();
        showAlert('success', 'Autenticado com sucesso!');
        localStorage.setItem('authToken', token);
        setView('login');
      },
      onFailure: (err) => {
        showAlert('error', err.message || 'Erro ao validar código MFA.');
      }
    });
    setLoading(false);
  };

  const handleResetPassword = () => {
    if (!cognitoUser) return;
  
    cognitoUser.confirmPassword(resetCode, newPassword, {
      onSuccess: () => {
        showAlert('success', 'Senha redefinida com sucesso.');
        setView('login');
      },
      onFailure: (err) => {
        showAlert('error', err.message || 'Erro ao redefinir senha.');
      }
    });
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
        window.location.href = "https://extranet-a5x.vercel.app/";
      } else showAlert('error', response.message);
    } catch (error) {
      showAlert('error', 'Erro interno do servidor. Tente novamente.');
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    const email = formData.email;
    if (!validateEmail(email)) {
      showAlert('error', 'Insira um e-mail válido para recuperar sua senha.');
      return;
    }
    setForgotEmail(email);
    const user = new CognitoUser({ Username: email, Pool: userPool });
    user.forgotPassword({
      onSuccess: () => {
        showAlert('info', 'Um código foi enviado para seu e-mail.');
        setCognitoUser(user);
        setView('resetPassword');
      },
      onFailure: (err) => {
        showAlert('error', err.message || 'Erro ao solicitar redefinição de senha.');
      }
    });
  };

  const handleNewPasswordSubmit = () => {
    if (!cognitoUser) return;
    if (!newRequiredPassword || !confirmPassword) {
      showAlert('error', 'Preencha todos os campos.');
      return;
    }
    if (newRequiredPassword !== confirmPassword) {
      showAlert('error', 'As senhas não coincidem.');
      return;
    }
  
    setLoading(true);
  
    cognitoUser.completeNewPasswordChallenge(newRequiredPassword, {}, {
      onSuccess: (session) => {
        const token = session.getAccessToken().getJwtToken();
        localStorage.setItem('authToken', token);
        showAlert('success', 'Senha atualizada com sucesso!');
        setView('login');
        setLoading(false);
      },
      onFailure: (err) => {
        showAlert('error', err.message || 'Erro ao definir nova senha.');
        setLoading(false);
      }
    });
  };

  const handleTermsClick = (): void => {
    window.open('#', '_blank');
  };

  const handlePrivacyClick = (): void => {
    window.open('#', '_blank');
  };
  if (view === 'mfa') {
    return (
      <Container header="Verificação em duas etapas">
        <SpaceBetween size="m" direction="vertical">
          <input
            type="text"
            placeholder="Digite o código MFA"
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value)}
          />
          <Button onClick={handleMfaSubmit} loading={loading}>Validar código</Button>
        </SpaceBetween>
      </Container>
    );
  }
  
  if (view === 'resetPassword') {
    return (
      <Container header="Redefinir senha">
        <SpaceBetween size="m" direction="vertical">
          <input
            placeholder="Código recebido"
            value={resetCode}
            onChange={(e) => setResetCode(e.target.value)}
          />
          <input
            type="password"
            placeholder="Nova senha"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <Button onClick={handleResetPassword}>Redefinir senha</Button>
        </SpaceBetween>
      </Container>
    );
  }

  if (view === 'otp') {
    return (
      <Container header="Nova senha necessária">
        <SpaceBetween size="m" direction="vertical">
          <input
            type="password"
            placeholder="Nova senha"
            value={newRequiredPassword}
            onChange={(e) => setNewRequiredPassword(e.target.value)}
          />
          <input
            type="password"
            placeholder="Confirme a nova senha"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <Button onClick={handleNewPasswordSubmit} loading={loading}>
            Definir nova senha
          </Button>
        </SpaceBetween>
      </Container>
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
                  onClick={() => setFormData({ email: 'p-guilherme.valeriano@a5x.com.br', password: 'seven@123' })}
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
              © {new Date().getFullYear()} A5X Bolsa de Valores. Todos os direitos reservados.
            </div>
          </div>
        </Box>
      </div>
    </div>
  );
};

export default App;

