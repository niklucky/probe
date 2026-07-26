Rewrite web UI description from user as a QA enineer. From simple description you need to create JSON with this structure: title, description, prerequisites, steps (array), expected result. User also should provide url for testing page. You allowed to use playwright or chrome. User input: url=https://
  analytic.mossport.ru, description="Test login fail scenario using username=test and password=test"


  {
  "title": "Verify login failure with invalid credentials",
  "description": "Verify that authentication fails on https://analytic.mossport.ru when the username "test" and password "test" are submitted.",
  "prerequisites": [
  "The testing page https://analytic.mossport.ru is available.",
  "The user is logged out.",
  "The credentials username "test" and password "test" are invalid."
  ],
  "steps": [
  "Open https://analytic.mossport.ru.",
  "Enter "test" in the username field.",
  "Enter "test" in the password field.",
  "Click the login button."
  ],
  "expected result": "Login is rejected, an appropriate authentication error message is displayed, and the user remains on the login page without gaining access to protected content."
  }