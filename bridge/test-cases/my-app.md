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
url: https://your-app.com/dashboard
credentials: MY_APP
description: Post-login landing page — key widgets and navigation

## Search
testId: QA-MYAPP-03
url: https://your-app.com/search
credentials: MY_APP
description: Search page — enter keyword and verify results appear

## Create Record
testId: QA-MYAPP-04
url: https://your-app.com/create
credentials: MY_APP
description: Create new record form — fill fields and submit
