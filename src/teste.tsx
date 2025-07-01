import { useState } from 'react'
import { CognitoIdentityProviderClient, InitiateAuthCommand, RespondToAuthChallengeCommand } from "@aws-sdk/client-cognito-identity-provider";
import './App.css'
const config = { region: "us-east-1" }

const cognitoClient = new CognitoIdentityProviderClient(config);
const clientId = "2b95s6s1ntfv6l2q9jspe5tcdf"

function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [view, setView] = useState("login");
  const [session, setSession] = useState("");

  const handleLogin = async () => {
    const input = {
      "AuthFlow": "USER_PASSWORD_AUTH",
      "AuthParameters": {
        "USERNAME": email,
        "PASSWORD": password,
      },
      "ClientId": clientId,
    };
    const command = new InitiateAuthCommand(input);
    const response = await cognitoClient.send(command);

    console.log(response)
    if (response.ChallengeName === "NEW_PASSWORD_REQUIRED") {
      if(response !== undefined){
        setSession(response.Session)
      }
      setView('otp')
    }
    else if (response['$metadata']['httpStatusCode'] === 200) alert("Login Successfull!")
  }

  const handleChallenge = async () => {
    const input = { // RespondToAuthChallengeRequest
      ClientId: clientId, // required
      ChallengeName: "NEW_PASSWORD_REQUIRED",
      Session: session,
      ChallengeResponses: {
        "NEW_PASSWORD": password, "USERNAME": email
      },
    };
    const command = new RespondToAuthChallengeCommand(input);
    const response = await cognitoClient.send(command);
    console.log(response)
    if (response['$metadata']['httpStatusCode'] === 200) { alert("Password Changed Successfully!"); setView('login') }
  }

  return (view === "login" ?
    <div className='card'>
      <input placeholder='Enter email' value={email} onChange={e => setEmail(e.target.value)} />
      <input placeholder='Enter password' value={password} onChange={e => setPassword(e.target.value)} />
      <br />
      <button onClick={handleLogin}>Login</button>
    </div>
    :
    <div className='card'>
      <input placeholder='Enter new password' value={password} onChange={e => setPassword(e.target.value)} />
      <br />
      <button onClick={handleChallenge}>Save New Password</button>

    </div>
  )
}

export default App