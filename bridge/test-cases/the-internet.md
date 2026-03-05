# Test Cases — The Internet (herokuapp)
# credentials: prefix maps to <PREFIX>_USERNAME / <PREFIX>_PASSWORD in .env

## Login Page
testId: QA-INTERNET-03-GEN
url: https://the-internet.herokuapp.com/login
credentials: THE_INTERNET
description: Standard login form with username/password fields

## Dropdown
testId: QA-INTERNET-04-GEN
url: https://the-internet.herokuapp.com/dropdown
description: Single dropdown selector with two options

## Checkboxes
testId: QA-INTERNET-05-GEN
url: https://the-internet.herokuapp.com/checkboxes
description: Two checkboxes, one checked by default

## Secure Area
testId: QA-INTERNET-06-GEN
url: https://the-internet.herokuapp.com/login
credentials: THE_INTERNET
description: Secure area — only accessible after login
steps:
  - login
