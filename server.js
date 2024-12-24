import express from 'express';
import { test as playwrightTest } from '@playwright/test';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
app.use(express.json());
app.use('/screenshots', express.static('screenshots'));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
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
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Website Testing Report</h1>
            <p class="timestamp">Generated on: ${timestamp}</p>
            <div class="status ${result.status}">${result.status}</div>
        </div>

        <div class="section">
            <h2>Test Information</h2>
            <p><strong>Website:</strong> video-converter.com</p>
            <p><strong>Test Case:</strong> ${result.testName}</p>
            <p><strong>Test Duration:</strong> ${Math.round((new Date(result.timestamp) - new Date(result.startTime)) / 1000)} seconds</p>
        </div>

        <div class="section">
            <h2>Test Steps</h2>
            ${result.steps.map(step => {
              const failed = result.failedSteps.includes(step);
              return `
                <div class="step ${failed ? 'failed' : 'success'}">
                    <p>${failed ? '❌' : '✅'} ${step}</p>
                    ${failed && result.error ? `
                        <div class="error">
                            Error: ${result.error}
                        </div>
                    ` : ''}
                </div>
              `;
            }).join('')}
        </div>

        <div class="section">
            <h2>AI Analysis</h2>
            <div class="analysis">
                ${result.description}
            </div>
        </div>

        <div class="section">
            <h2>Screenshots</h2>
            <div class="screenshots">
                ${result.screenshots.map((screenshot, index) => `
                    <div class="screenshot">
                        <img src="/screenshots/${screenshot}" alt="Screenshot ${index + 1}">
                        <p>Step ${index + 1}: ${screenshot.replace(/\\d{4}-\\d{2}-\\d{2}T.*\\.png$/, '')}</p>
                    </div>
                `).join('')}
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
    const startTime = new Date().toISOString();
    const testResult = await runVideoConverterTest(browser);
    testResult.startTime = startTime;
    
    // Generate HTML report
    const htmlReport = generateHtmlReport(testResult);
    
    // Save HTML report
    const reportPath = path.join(process.cwd(), 'test-report.html');
    fs.writeFileSync(reportPath, htmlReport);
    
    testResults.push(testResult);
    await browser.close();
    
    // Return both JSON result and HTML report URL
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

async function runVideoConverterTest(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const startTime = new Date();
  const steps = [];
  let failedSteps = [];
  const screenshots = [];

  try {
    // Create screenshots directory if it doesn't exist
    const screenshotDir = './screenshots';
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir);
    }

    // First, check if the site is accessible
    steps.push('Check website availability');
    try {
      await page.goto('https://video-converter.com/', { 
        timeout: 10000,
        waitUntil: 'domcontentloaded'
      });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      await page.screenshot({ 
        path: path.join(screenshotDir, `initial-load-${timestamp}.png`),
        fullPage: true 
      });
      screenshots.push(`initial-load-${timestamp}.png`);
    } catch (error) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      await page.screenshot({ 
        path: path.join(screenshotDir, `load-error-${timestamp}.png`),
        fullPage: true 
      });
      screenshots.push(`load-error-${timestamp}.png`);
      throw new Error(`Website is not accessible: ${error.message}`);
    }

    // If we get here, the site loaded
    console.log('Website loaded successfully, proceeding with test...');
    
    // Rest of the test code...
    steps.push('Analyze page structure');
    const pageTitle = await page.title();
    console.log('Page title:', pageTitle);

    // Log page status
    const response = await page.reload({ waitUntil: 'domcontentloaded' });
    console.log('Page status:', response.status());
    
    // Record test steps and results
    steps.push('Navigate to video-converter.com');
    await page.goto('https://video-converter.com/');
    
    // Wait for page load and analyze structure
    steps.push('Analyze page structure');
    await page.waitForLoadState('networkidle');
    
    // Log all input fields and buttons for analysis
    const inputFields = await page.$$eval('input', inputs => 
      inputs.map(input => ({
        type: input.type,
        id: input.id,
        name: input.name,
        placeholder: input.placeholder,
        isVisible: input.offsetParent !== null
      }))
    );
    console.log('Available input fields:', JSON.stringify(inputFields, null, 2));

    // Try to input YouTube URL
    steps.push('Attempt to interact with URL input');
    const youtubeUrl = 'https://www.youtube.com/watch?v=aWk2XZ_8IhA';
    
    // Try multiple potential selectors
    const possibleSelectors = [
      'input[type="url"]',
      'input[type="text"]',
      'input[placeholder*="url" i]',
      'input[placeholder*="link" i]',
      '#videoUrl',
      '#url',
      '.url-input'
    ];

    let foundInput = false;
    for (const selector of possibleSelectors) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      await page.screenshot({ 
        path: path.join(screenshotDir, `attempt-input-${timestamp}.png`),
        fullPage: true 
      });
      screenshots.push(`attempt-input-${timestamp}.png`);

      const input = await page.$(selector);
      if (input) {
        try {
          await input.fill(youtubeUrl);
          foundInput = true;
          console.log(`Successfully used selector: ${selector}`);
          break;
        } catch (e) {
          console.log(`Failed with selector ${selector}:`, e.message);
        }
      }
    }

    if (!foundInput) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      await page.screenshot({ 
        path: path.join(screenshotDir, `no-input-found-${timestamp}.png`),
        fullPage: true 
      });
      screenshots.push(`no-input-found-${timestamp}.png`);
      throw new Error('Could not find suitable input method for URL');
    }

    // Final screenshot
    const finalTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await page.screenshot({ 
      path: path.join(screenshotDir, `final-state-${finalTimestamp}.png`),
      fullPage: true 
    });
    screenshots.push(`final-state-${finalTimestamp}.png`);

    // Generate AI analysis of the test results
    const aiAnalysis = await generateAIAnalysis(steps, failedSteps);

    return {
      testName: 'YouTube URL Upload Test - video-converter.com',
      status: 'fail',
      timestamp: startTime.toISOString(),
      steps: steps,
      failedSteps: failedSteps,
      screenshots: screenshots,
      description: aiAnalysis,
      pageAnalysis: {
        inputFields,
        buttons: await page.$$eval('button, .btn, [role="button"]', 
          btns => btns.map(b => ({
            text: b.textContent,
            isVisible: b.offsetParent !== null,
            classes: b.className
          }))
        )
      }
    };

  } catch (error) {
    failedSteps.push(steps[steps.length - 1]);
    
    // Generate AI analysis of the test results
    const aiAnalysis = await generateAIAnalysis(steps, failedSteps);

    return {
      testName: 'YouTube URL Upload Test - video-converter.com',
      status: 'fail',
      timestamp: startTime.toISOString(),
      steps: steps,
      failedSteps: failedSteps,
      screenshots: screenshots,
      description: aiAnalysis,
      error: error.message
    };
  } finally {
    await context.close();
  }
}

async function findInputElement(page) {
  // Common selectors for URL input fields
  const selectors = [
    'input[type="url"]',
    'input[type="text"]',
    '[placeholder*="url" i]',
    '[placeholder*="link" i]',
    '[role="textbox"]'
  ];

  for (const selector of selectors) {
    const element = await page.$(selector);
    if (element) return selector;
  }
  return null;
}

async function generateAIAnalysis(steps, failedSteps) {
  const prompt = `Analyze this website test result:
    Steps performed: ${steps.join(', ')}
    Failed steps: ${failedSteps.join(', ')}
    
    Generate a brief, professional description of the test results, explaining why the test failed and what it means for the website's functionality.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: "You are a QA testing expert analyzing website test results."
      },
      {
        role: "user",
        content: prompt
      }
    ]
  });

  return response.choices[0].message.content;
}
