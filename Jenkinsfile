pipeline {
    agent any

    environment {
        // Set these in Jenkins → Manage Jenkins → Credentials
        // or as pipeline env vars in the job config
        BRIDGE_URL     = 'http://localhost:3000'
        BRIDGE_API_KEY = credentials('BRIDGE_API_KEY')   // Jenkins secret
        BASE_URL       = credentials('APP_BASE_URL')      // Jenkins secret
    }

    stages {

        stage('Install') {
            steps {
                sh '''
                    cd $HOME/anthropic
                    npm ci
                    npx playwright install chromium --with-deps
                '''
            }
        }

        stage('Run Tests') {
            steps {
                // Always run this stage — we capture results in post{}
                sh '''
                    cd $HOME/anthropic
                    npx playwright test --project=chromium || true
                '''
            }
        }

        stage('Auto-Heal on Failure') {
            // Only run this stage if tests produced failures
            when {
                expression {
                    return fileExists('test-results/junit.xml') &&
                           sh(script: "grep -q '<failure' $WORKSPACE/test-results/junit.xml", returnStatus: true) == 0
                }
            }
            steps {
                echo 'Tests failed — running auto-heal...'
                sh '''
                    cd $HOME/anthropic
                    node scripts/heal-on-failure.js
                '''
            }
        }

    }

    post {
        always {
            // Publish JUnit test results
            junit testResults: 'test-results/junit.xml',
                  allowEmptyResults: true

            // Archive HTML report
            publishHTML(target: [
                allowMissing         : true,
                alwaysLinkToLastBuild: true,
                keepAll              : true,
                reportDir            : 'playwright-report',
                reportFiles          : 'index.html',
                reportName           : 'Playwright Report'
            ])

            // Archive heal suggestions if they exist
            archiveArtifacts artifacts: 'test-results/heal-suggestions.json',
                             allowEmptyArchive: true
        }

        failure {
            echo '''
======================================================
Some tests failed. Check:
  1. Playwright Report (link above) — full step-by-step trace
  2. test-results/heal-suggestions.json — AI-suggested locator fixes
======================================================
'''
        }

        success {
            echo 'All tests passed.'
        }
    }
}
