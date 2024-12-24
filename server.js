import express from 'express';
import { test as playwrightTest } from '@playwright/test';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import TestOrchestrator from './lib/test_orchestrator.js';

dotenv.config();

const app = express();
app.use(express.json());
app.use('/screenshots', express.static('screenshots'));

// Initialize test orchestrator
const orchestrator = new TestOrchestrator({
    screenshotDir: './screenshots',
    maxRetries: 3,
    timeout: 30000
});

// Store test results
let testResults = [];

function generateHtmlReport(result) {
    const timestamp = new Date().toLocaleString('en-US', { 
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });

    const stepsHtml = result.state.history.map(step => {
        const failed = result.state.artifacts.errors.some(error => error.step === step.step);
        const error = failed ? result.state.artifacts.errors.find(e => e.step === step.step) : null;
        
        return `
            <div class="step ${failed ? 'failed' : 'success'}">
                <p>${failed ? '❌' : '✅'} ${step.step}</p>
                ${error ? `
                    <div class="error">
                        Error: ${error.error}
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');

    const screenshotsHtml = result.state.artifacts.screenshots.map((screenshot, index) => `
        <div class="screenshot">
            <img src="/screenshots/${screenshot.path}" alt="Screenshot ${index + 1}">
            <p>Step ${index + 1}: ${screenshot.step || 'Unknown step'}</p>
        </div>
    `).join('');

    const analysisHtml = result.state.artifacts.analysis.map(analysis => `
        <div class="analysis-item">
            <p><strong>Step:</strong> ${analysis.step || 'General'}</p>
            <p>${analysis.content}</p>
        </div>
    `).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Website Testing Report - video-converter.com</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background-color: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #eee;
        }
        .status {
            display: inline-block;
            padding: 8px 16px;
            border-radius: 4px;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 14px;
        }
        .status.fail {
            background-color: #ffebee;
            color: #c62828;
        }
        .status.pass {
            background-color: #e8f5e9;
            color: #2e7d32;
        }
        .section {
            margin-bottom: 30px;
        }
        .section h2 {
            color: #333;
            border-bottom: 1px solid #eee;
            padding-bottom: 10px;
        }
        .step {
            margin: 10px 0;
            padding: 10px;
            background-color: #f8f9fa;
            border-radius: 4px;
        }
        .step.failed {
            background-color: #fff3f3;
            border-left: 4px solid #dc3545;
        }
        .step.success {
            background-color: #f3fff3;
            border-left: 4px solid #28a745;
        }
        .screenshots {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }
        .screenshot {
            background-color: white;
            padding: 10px;
            border-radius: 4px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .screenshot img {
            width: 100%;
            height: auto;
            border: 1px solid #eee;
            border-radius: 4px;
        }
        .screenshot p {
            margin: 10px 0 0 0;
            font-size: 14px;
            color: #666;
        }
        .error {
            background-color: #fff3f3;
            padding: 15px;
            border-radius: 4px;
            margin: 10px 0;
            color: #dc3545;
            font-family: monospace;
        }
        .timestamp {
            color: #666;
            font-size: 14px;
        }
        .analysis {
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 4px;
            margin: 20px 0;
        }
        .analysis-item {
            margin-bottom: 20px;
            padding: 15px;
            background-color: white;
            border-radius: 4px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Website Testing Report</h1>
            <p class="timestamp">Generated on: ${timestamp}</p>
            <div class="status ${result.state.metadata.status}">${result.state.metadata.status}</div>
        </div>

        <div class="section">
            <h2>Test Information</h2>
            <p><strong>Website:</strong> video-converter.com</p>
            <p><strong>Test Case:</strong> YouTube URL Upload Test</p>
            <p><strong>Duration:</strong> ${Math.round((new Date(result.state.metadata.endTime) - new Date(result.state.metadata.startTime)) / 1000)} seconds</p>
        </div>

        <div class="section">
            <h2>Test Steps</h2>
            ${stepsHtml}
        </div>

        <div class="section">
            <h2>AI Analysis</h2>
            <div class="analysis">
                ${analysisHtml}
            </div>
        </div>

        <div class="section">
            <h2>Screenshots</h2>
            <div class="screenshots">
                ${screenshotsHtml}
            </div>
        </div>

        <div class="section">
            <h2>Recommendations</h2>
            <ul>
                <li>Consider manual testing to verify the exact user interaction flow</li>
                <li>Investigate if the website requires specific user interactions before showing the input field</li>
                <li>Check if the website has implemented measures to prevent automated access</li>
                <li>Consider using a different video converter service that allows automated testing</li>
            </ul>
        </div>
    </div>
</body>
</html>`;
}

app.post('/api/run-test', async (req, res) => {
    try {
        const browser = await playwrightTest.chromium.launch();
        const context = await browser.newContext();
        const page = await context.newPage();

        const testConfig = {
            url: 'https://video-converter.com',
            steps: [
                {
                    name: 'Check website availability',
                    action: async (page) => {
                        await page.waitForLoadState('domcontentloaded');
                    }
                },
                {
                    name: 'Locate URL input',
                    action: async (page) => {
                        const selectors = [
                            'input[type="url"]',
                            'input[type="text"]',
                            'input[placeholder*="url" i]',
                            'input[placeholder*="link" i]',
                            '#videoUrl',
                            '#url',
                            '.url-input'
                        ];

                        for (const selector of selectors) {
                            const input = await page.$(selector);
                            if (input) {
                                await input.fill('https://www.youtube.com/watch?v=aWk2XZ_8IhA');
                                return;
                            }
                        }
                        throw new Error('Could not find suitable input method for URL');
                    }
                }
            ]
        };

        const testResult = await orchestrator.runTest(page, testConfig);
        
        // Generate HTML report
        const htmlReport = generateHtmlReport(testResult);
        const reportPath = path.join(process.cwd(), 'test-report.html');
        fs.writeFileSync(reportPath, htmlReport);

        await browser.close();
        
        res.json({
            ...testResult,
            htmlReport: '/test-report.html'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Serve the HTML report
app.get('/test-report.html', (req, res) => {
    const reportPath = path.join(process.cwd(), 'test-report.html');
    if (fs.existsSync(reportPath)) {
        res.sendFile(reportPath);
    } else {
        res.status(404).send('No test report available');
    }
});

app.get('/api/test-results', (req, res) => {
    res.json(testResults);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
