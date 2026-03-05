# Test Cases — My App
# Replace MY_APP with your app's prefix (e.g. MYAPP, PORTAL, CRM)
# Credentials must be set in ~/anthropic/.env as:
#   MY_APP_USERNAME=qa@yourcompany.com
#   MY_APP_PASSWORD=your_password

## Login
testId: QA-MYAPP-01
url: https://your-app.com/login
credentials: MY_APP
description: Main login form — username and password fields

## Dashboard
testId: QA-MYAPP-02
url: https://your-app.com/login
credentials: MY_APP
description: Post-login landing page — key widgets and navigation
steps:
  - login

## Search
testId: QA-MYAPP-03
url: https://your-app.com/login
credentials: MY_APP
description: Search page — enter keyword and verify results appear
steps:
  - login
  - click: Search

## Create Record
testId: QA-MYAPP-04
url: https://your-app.com/login
credentials: MY_APP
description: Create new record form — navigate from dashboard
steps:
  - login
  - click: Records
  - click: Create New

## Monthly Report
testId: QA-MYAPP-05
url: https://your-app.com/login
credentials: MY_APP
description: Monthly summary report — multi-level navigation after login
steps:
  - login
  - click: Reports
  - click: Monthly Summary
